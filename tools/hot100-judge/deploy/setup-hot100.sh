#!/bin/sh
# Runs on the VPS as root, once (and safely again): the account, directories, environment,
# Eclipse JDT LS and the service for the Hot 100 judge. Expects hot100-judge.service next to
# this script. Does not start the service; install a release with install-hot100.sh.
#
#   sh setup-hot100.sh            # everything except swap
#   SWAP=2G sh setup-hot100.sh    # also grow /swapfile to 2 GiB (recommended: the judge adds ~1.2 GB)
set -eu
here=$(cd "$(dirname "$0")" && pwd)

# JDT LS release and its SHA-256 (from download.eclipse.org/jdtls/milestones/<version>/).
JDTLS_VERSION=1.63.0
JDTLS_FILE=jdt-language-server-1.63.0-202610191322.tar.gz
JDTLS_SHA256=b1f2abe0b3cccb462cf64fb4a5587c7d09df60cf8be7748b152cbd89d018bdc4
JAVA_HOME=/usr/lib/jvm/java-25-openjdk-amd64

# Packages: JDK 25 (javac, and Java for JDT LS), bubblewrap for the sandbox.
missing=""
for p in openjdk-25-jdk-headless bubblewrap; do dpkg -s "$p" >/dev/null 2>&1 || missing="$missing $p"; done
if [ -n "$missing" ]; then apt-get update -q && apt-get install -y -q --no-install-recommends $missing; fi
[ -x "$JAVA_HOME/bin/javac" ] || { echo "no javac in $JAVA_HOME" >&2; exit 1; }
[ "$(sysctl -n kernel.unprivileged_userns_clone 2>/dev/null || echo 1)" = 1 ] || { echo "unprivileged user namespaces are off; bubblewrap needs them" >&2; exit 1; }

id hot100 >/dev/null 2>&1 || useradd --system --home-dir /nonexistent --shell /usr/sbin/nologin hot100
mkdir -p /srv/hot100/releases /etc/hot100 /opt/hot100
chmod 755 /srv/hot100 /srv/hot100/releases /opt/hot100

# JDT LS, verified, in its own versioned folder; /opt/hot100/jdtls points at it.
target=/opt/hot100/jdtls-$JDTLS_VERSION
if [ ! -d "$target/plugins" ]; then
    tmp=$(mktemp -d)
    curl -sSfL -o "$tmp/jdtls.tar.gz" "https://download.eclipse.org/jdtls/milestones/$JDTLS_VERSION/$JDTLS_FILE"
    echo "$JDTLS_SHA256  $tmp/jdtls.tar.gz" | sha256sum -c - >/dev/null
    mkdir -p "$target.part" && tar -xzf "$tmp/jdtls.tar.gz" -C "$target.part"
    chmod -R a+rX,go-w "$target.part" && mv "$target.part" "$target"
    rm -rf "$tmp"
    echo "JDT LS $JDTLS_VERSION installed in $target"
fi
ln -sfn "$target" /opt/hot100/jdtls

umask 077
cat > /etc/hot100/env.next <<EOF
HOT100_PORT=4310
HOT100_HOST=127.0.0.1
HOT100_ORIGINS=https://hhikr.moe
HOT100_TRUST_PROXY=1
HOT100_SANDBOX=bwrap
HOT100_SANDBOX_JAVA=$JAVA_HOME/bin/java
HOT100_WORK=/var/lib/hot100
HOT100_JDTLS=/opt/hot100/jdtls
JAVA_HOME=$JAVA_HOME
EOF
chown root:hot100 /etc/hot100/env.next
chmod 640 /etc/hot100/env.next
mv -f /etc/hot100/env.next /etc/hot100/env
umask 022

# Optional: a larger swap file, so a busy moment does not push other services into the OOM killer.
if [ -n "${SWAP:-}" ]; then
    current=$(swapon --show=NAME,SIZE --bytes --noheadings 2>/dev/null | awk '$1=="/swapfile"{print $2}')
    want=$(numfmt --from=iec "$SWAP")
    if [ "${current:-0}" -lt "$want" ]; then
        [ -n "$current" ] && swapoff /swapfile
        fallocate -l "$SWAP" /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
        grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
        echo "swap: /swapfile is now $SWAP"
    fi
fi

install -m 0644 "$here/hot100-judge.service" /etc/systemd/system/hot100-judge.service
systemctl daemon-reload
systemctl enable hot100-judge >/dev/null 2>&1
echo "hot100-judge is set up; install a release with install-hot100.sh, then add the Caddy route"
