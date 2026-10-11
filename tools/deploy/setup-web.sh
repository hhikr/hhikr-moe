#!/bin/sh
# One-time VPS setup for the Node service: a checksum-verified Node.js build
# from nodejs.org, the service account, directories and the environment file.
# Safe to run again; it does not overwrite an existing environment file.
set -eu

version=v24.19.0
archive="node-$version-linux-x64.tar.xz"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

if [ ! -x "/opt/node-$version/bin/node" ]; then
    cd "$work"
    curl -fsSLO "https://nodejs.org/dist/$version/$archive"
    curl -fsSL "https://nodejs.org/dist/$version/SHASUMS256.txt" | grep " $archive\$" | sha256sum -c -
    mkdir -p "/opt/node-$version"
    tar -xJf "$archive" -C "/opt/node-$version" --strip-components=1
fi
for tool in node npm npx; do
    ln -sfn "/opt/node-$version/bin/$tool" "/usr/local/bin/$tool"
done
node --version
npm --version

id hhikr-web >/dev/null 2>&1 || useradd --system --user-group --no-create-home --shell /usr/sbin/nologin hhikr-web

mkdir -p /srv/hhikr/app/releases /srv/hhikr/data /etc/hhikr-web
chown hhikr-web:hhikr-web /srv/hhikr/data
chmod 750 /srv/hhikr/data

# Caddy serves /media/ and /pagefind/ straight from the data directory, so it
# needs group read access. A new group only takes effect after a restart.
if ! id -nG caddy | tr ' ' '\n' | grep -qx hhikr-web; then
    usermod -aG hhikr-web caddy
    systemctl restart caddy
fi

if [ ! -f /etc/hhikr-web/env ]; then
    printf 'HOST=127.0.0.1\nPORT=4400\nDATA_DIR=/srv/hhikr/data\nSITE_ORIGIN=https://hhikr.moe\n' > /etc/hhikr-web/env
fi
chown root:hhikr-web /etc/hhikr-web/env
chmod 640 /etc/hhikr-web/env

install -m 0644 /root/hhikr-web.service /etc/systemd/system/hhikr-web.service
systemctl daemon-reload
systemctl enable hhikr-web

id hhikr-web
ls -ld /srv/hhikr/app /srv/hhikr/data /etc/hhikr-web/env
