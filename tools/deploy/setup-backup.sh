#!/bin/sh
# One-time VPS setup for backups: git, the backup repository's git directory,
# the two environment entries, and the daily timer. Safe to run again.
# Usage: setup-backup.sh <owner/repository> [file holding the access token]
# The token file is removed after its content has been stored in the
# environment file. Without it, an existing token is kept.
set -eu

repo=${1:?usage: setup-backup.sh <owner/repository> [token file]}
token_file=${2:-}
env=/etc/hhikr-web/env

command -v git >/dev/null 2>&1 || { apt-get update -q && apt-get install -y -q git; }
git --version

mkdir -p /srv/hhikr/backup.git
chown hhikr-web:hhikr-web /srv/hhikr/backup.git
chmod 700 /srv/hhikr/backup.git

# Replace rather than append, so running this again does not leave duplicates.
set_env() {
    tmp=$(mktemp)
    grep -v "^$1=" "$env" > "$tmp" || true
    printf '%s=%s\n' "$1" "$2" >> "$tmp"
    cat "$tmp" > "$env"
    rm -f "$tmp"
}
set_env BACKUP_REPO "$repo"
if [ -n "$token_file" ]; then
    set_env BACKUP_GITHUB_TOKEN "$(tr -d ' \r\n' < "$token_file")"
    rm -f "$token_file"
fi
chown root:hhikr-web "$env"
chmod 640 "$env"
grep -q '^BACKUP_GITHUB_TOKEN=.' "$env" || { echo "no access token in $env" >&2; exit 1; }

install -m 0644 /root/hhikr-web.service /etc/systemd/system/hhikr-web.service
install -m 0644 /root/hhikr-backup.service /etc/systemd/system/hhikr-backup.service
install -m 0644 /root/hhikr-backup.timer /etc/systemd/system/hhikr-backup.timer
systemctl daemon-reload
systemctl enable --now hhikr-backup.timer
systemctl restart hhikr-web
systemctl list-timers hhikr-backup.timer --no-pager | head -3
