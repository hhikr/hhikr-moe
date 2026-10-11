#!/bin/sh
# Runs on the VPS: unpack a build into its own release directory, install
# production dependencies, switch the `current` link and restart the service.
# Rolls back to the previous release if the health check fails.
# Usage: release.sh /root/hhikr-app.tar.gz
set -eu

tarball=${1:?usage: release.sh <tarball>}
app=/srv/hhikr/app
id=$(date -u +%Y%m%dT%H%M%SZ)
dir="$app/releases/$id"

healthy() {
    i=0
    while [ "$i" -lt 15 ]; do
        if [ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4400/api/health)" = 200 ]; then return 0; fi
        i=$((i + 1))
        sleep 1
    done
    return 1
}

switch_to() {
    rm -f "$app/current.next"
    ln -s "$1" "$app/current.next"
    mv -Tf "$app/current.next" "$app/current"
    systemctl restart hhikr-web
}

mkdir -p "$dir"
tar -xzf "$tarball" -C "$dir"
for required in dist/server/entry.mjs dist/client/404.html scripts/rebuild-search.mjs; do
    if [ ! -f "$dir/$required" ]; then
        echo "the archive is missing $required" >&2
        exit 1
    fi
done
(cd "$dir" && npm ci --omit=dev --no-audit --no-fund)
chmod -R a+rX "$dir"

prev=$(readlink -f "$app/current" 2>/dev/null || true)
switch_to "$dir"

if healthy; then
    echo "released $id"
    # The search index covers the prerendered pages of this build plus the
    # posts in the database. A failure here leaves the previous index in place.
    if ! runuser -u hhikr-web -- sh -c "umask 027; set -a; . /etc/hhikr-web/env; set +a; cd '$dir' && node scripts/rebuild-search.mjs"; then
        echo "warning: search index was not rebuilt" >&2
    fi
    # Each release carries its own node_modules (about 370 MB). Keep the three newest.
    ls -1d "$app"/releases/*/ | sort | head -n -3 | while read -r old; do
        case "$(readlink -f "$old")" in
            "$(readlink -f "$app/current")") ;;
            *) rm -rf "$old" && echo "removed old release $(basename "$old")" ;;
        esac
    done
    exit 0
fi

echo "health check failed for $id" >&2
journalctl -u hhikr-web --no-pager -n 30 >&2 || true
if [ -n "$prev" ] && [ -d "$prev" ]; then
    switch_to "$prev"
    echo "rolled back to $prev" >&2
fi
exit 1
