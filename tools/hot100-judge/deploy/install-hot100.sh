#!/bin/sh
# Runs on the VPS as root: unpack a judge package (made by `npm run judge:package`) as a new
# release, point /srv/hot100/current at it, restart the service and wait until it answers.
# If it does not come up, the previous release is put back. Old releases are kept; deleting them
# is a separate, explicit step (docs/VPS_RUNBOOK.md keeps releasing and cleaning up apart).
#
#   sh install-hot100.sh /root/hot100-judge.tar.gz
#   sh install-hot100.sh --rollback
#   sh install-hot100.sh --prune        # delete all but the three newest releases (never current)
set -eu
releases=/srv/hot100/releases

health() {
    for _ in $(seq 1 30); do
        curl -sf http://127.0.0.1:4310/api/hot100/health >/dev/null 2>&1 && return 0
        sleep 1
    done
    return 1
}

previous=$(readlink -f /srv/hot100/current 2>/dev/null || true)

if [ "${1:-}" = "--prune" ]; then
    ls -1d "$releases"/*/ | sed 's#/$##' | sort | head -n -3 | while read -r old; do
        [ "$old" = "$previous" ] || { rm -rf "$old"; echo "deleted $(basename "$old")"; }
    done
    exit 0
fi

if [ "${1:-}" = "--rollback" ]; then
    target=$(ls -1d "$releases"/*/ | sed 's#/$##' | grep -vx "$previous" | sort | tail -n 1)
    [ -n "$target" ] || { echo "no other release to roll back to" >&2; exit 1; }
else
    package=${1:?usage: install-hot100.sh <package.tar.gz> | --rollback}
    target=$releases/$(date -u +%Y%m%dT%H%M%SZ)
    mkdir -p "$target.part"
    tar -xzf "$package" -C "$target.part"
    [ -f "$target.part/tools/hot100-judge/server.mjs" ] || { echo "not a judge package" >&2; rm -rf "$target.part"; exit 1; }
    chown -R root:root "$target.part" && chmod -R a+rX,go-w "$target.part"
    mv "$target.part" "$target"
fi

ln -sfn "$target" /srv/hot100/current.next && mv -T /srv/hot100/current.next /srv/hot100/current
systemctl restart hot100-judge
if health; then
    echo "hot100-judge is running $(basename "$target")"
    curl -s http://127.0.0.1:4310/api/hot100/health; echo
else
    echo "hot100-judge did not answer; last log lines:" >&2
    journalctl -u hot100-judge -n 30 --no-pager >&2 || true
    if [ -n "$previous" ] && [ "$previous" != "$target" ]; then
        ln -sfn "$previous" /srv/hot100/current.next && mv -T /srv/hot100/current.next /srv/hot100/current
        systemctl restart hot100-judge
        echo "put back $(basename "$previous")" >&2
    fi
    exit 1
fi
