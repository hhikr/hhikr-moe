#!/usr/bin/env bash
set -euo pipefail

# 在 VPS 上执行；密码仅在服务器生成，不作为命令行参数传递。
if [[ $(id -u) != 0 ]]; then
  echo '请以 root 执行。' >&2
  exit 1
fi
if [[ -e /etc/hhikr-proxy/config.json ]]; then
  echo '代理配置已存在，停止安装，避免覆盖密码。' >&2
  exit 1
fi
if ss -lntu | awk '{print $5}' | grep -Eq ':24443$'; then
  echo '24443 端口已被占用，停止安装。' >&2
  exit 1
fi
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y shadowsocks-libev python3 curl
# 此脚本用于本项目的新代理实例；停用软件包自带的默认实例。
systemctl disable --now shadowsocks-libev.service
if ! id hhikr-proxy >/dev/null 2>&1; then
  useradd --system --user-group --no-create-home --shell /usr/sbin/nologin hhikr-proxy
fi
install -d -m 0750 -o root -g hhikr-proxy /etc/hhikr-proxy
install -d -m 0700 /root/hhikr-proxy-private
python3 -X utf8 - <<'PY'
import base64, json, os, secrets
from pathlib import Path
password = secrets.token_urlsafe(32)
server = {'server': '0.0.0.0', 'server_port': 24443, 'password': password,
          'method': 'aes-256-gcm', 'timeout': 300, 'mode': 'tcp_and_udp'}
config = Path('/etc/hhikr-proxy/config.json')
config.write_text(json.dumps(server, indent=2) + '\n')
os.chown(config, 0, __import__('grp').getgrnam('hhikr-proxy').gr_gid)
config.chmod(0o640)
private = Path('/root/hhikr-proxy-private')
client = dict(server, server='89.34.227.228', local_address='127.0.0.1', local_port=10808)
(private / 'client.json').write_text(json.dumps(client, indent=2) + '\n')
auth = base64.urlsafe_b64encode(f'aes-256-gcm:{password}'.encode()).decode().rstrip('=')
(private / 'connection.txt').write_text(
    '服务器：89.34.227.228\n端口：24443\n加密：aes-256-gcm\n密码：' + password +
    '\n\n导入链接：\nss://' + auth + '@89.34.227.228:24443#hhikr-Singapore\n')
(private / 'mihomo-node.yaml').write_text(
    'proxies:\n  - name: hhikr-Singapore\n    type: ss\n    server: 89.34.227.228\n'
    '    port: 24443\n    cipher: aes-256-gcm\n    password: "' + password + '"\n    udp: true\n')
for path in private.iterdir():
    path.chmod(0o600)
PY
cat > /etc/systemd/system/hhikr-proxy.service <<'UNIT'
[Unit]
Description=hhikr encrypted Shadowsocks proxy
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=hhikr-proxy
Group=hhikr-proxy
ExecStart=/usr/bin/ss-server -c /etc/hhikr-proxy/config.json -d 1.1.1.1
Restart=on-failure
RestartSec=3
LimitNOFILE=65536
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
UMask=0077

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now hhikr-proxy.service
systemctl is-active hhikr-proxy.service
echo '连接配置已生成到 /root/hhikr-proxy-private；未输出密码。'
