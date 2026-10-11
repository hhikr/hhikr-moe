#!/usr/bin/env python3
"""仅在 VPS 上验证代理；临时客户端只监听 VPS 的回环地址。"""
import json
import socket
import struct
import subprocess
import tempfile
import time
from pathlib import Path


def curl(port, url, seconds=20):
    return subprocess.run(
        ['curl', '--silent', '--show-error', '--max-time', str(seconds),
         '--noproxy', '', '--proxy', f'socks5h://127.0.0.1:{port}', url],
        capture_output=True, text=True)


def verify_udp(port):
    control = socket.create_connection(('127.0.0.1', port), timeout=8)
    control.sendall(b'\x05\x01\x00')
    assert control.recv(2) == b'\x05\x00', 'SOCKS 协商失败'
    control.sendall(b'\x05\x03\x00\x01' + b'\x00' * 6)
    reply = control.recv(64)
    assert reply[:4] == b'\x05\x00\x00\x01', 'UDP ASSOCIATE 失败'
    relay = (socket.inet_ntoa(reply[4:8]), struct.unpack('!H', reply[8:10])[0])
    transaction = b'\x48\x48'
    query = transaction + b'\x01\x00\x00\x01\x00\x00\x00\x00\x00\x00'
    query += b'\x0acloudflare\x03com\x00\x00\x01\x00\x01'
    packet = b'\x00\x00\x00\x01' + socket.inet_aton('1.1.1.1') + struct.pack('!H', 53) + query
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as udp:
        udp.settimeout(10)
        udp.sendto(packet, relay)
        answer = udp.recv(4096)
    control.close()
    assert answer[10:12] == transaction and answer[12] & 0x80, 'DNS UDP 响应无效'


def main():
    assert Path('/etc/hhikr-proxy/config.json').exists(), '代理未配置'
    assert subprocess.check_output(['systemctl', 'is-active', 'hhikr-proxy']).strip() == b'active'
    original = json.loads(Path('/etc/hhikr-proxy/config.json').read_text())
    processes = []
    try:
        with tempfile.TemporaryDirectory(prefix='hhikr-proxy-check-') as directory:
            for port, wrong in [(19080, False), (19081, True)]:
                config = dict(original, server='127.0.0.1', local_address='127.0.0.1', local_port=port)
                if wrong:
                    config['password'] = 'deliberately-invalid-test-password'
                path = Path(directory) / f'{port}.json'
                path.write_text(json.dumps(config))
                path.chmod(0o600)
                processes.append(subprocess.Popen(
                    ['ss-local', '-c', str(path), '-u'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
            time.sleep(1)
            trace = curl(19080, 'https://www.cloudflare.com/cdn-cgi/trace')
            assert trace.returncode == 0 and 'ip=89.34.227.228' in trace.stdout, '代理 HTTPS 或出口 IP 检查失败'
            home = curl(19080, 'https://hhikr.moe/')
            assert home.returncode == 0 and '/hot100/' in home.stdout, f'代理访问网站失败：curl={home.returncode}, {home.stderr.strip()}'
            bad = curl(19081, 'https://www.cloudflare.com/cdn-cgi/trace', 5)
            assert bad.returncode != 0, '错误密码没有被拒绝'
            verify_udp(19080)
            report = {'testedOn': 'VPS only', 'tcpHttps': True, 'exitIpv4': '89.34.227.228',
                      'website': True, 'wrongPasswordRejected': True, 'udpDns': True,
                      'clientComputerTested': False, 'mainlandReachabilityTested': False}
            Path('/root/hhikr-proxy-private/verification.json').write_text(json.dumps(report, indent=2) + '\n')
            Path('/root/hhikr-proxy-private/verification.json').chmod(0o600)
            print(json.dumps(report, indent=2))
    finally:
        for process in processes:
            process.terminate()
        for process in processes:
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


if __name__ == '__main__':
    main()
