# VPS 加密代理

服务器 `89.34.227.228` 提供 Shadowsocks 加密代理，端口 TCP/UDP `24443`，加密方式 `aes-256-gcm`。代理与网站的 Caddy 服务独立，不需要新增域名记录。

此次只配置和验证服务器：不安装电脑客户端，不切换系统代理、TUN、DNS 或路由，不用电脑测试连接。

## 配置与私密文件

| 项目 | 位置 |
| --- | --- |
| 服务 | `hhikr-proxy.service`，开机启动 |
| 程序 | Debian 官方包 `shadowsocks-libev`，`/usr/bin/ss-server` |
| 服务端配置 | `/etc/hhikr-proxy/config.json` |
| systemd 单元 | `/etc/systemd/system/hhikr-proxy.service` |
| 服务器私密导出 | `/root/hhikr-proxy-private/` |
| 本机私密导出 | `.deployment/proxy/`，不提交 Git、不发布到网站 |

导出文件包含 `connection.txt`（密码与 `ss://` 导入链接）、`client.json`（客户端配置）、`mihomo-node.yaml`（Mihomo 节点片段）和 `verification.json`（检查结果）。密码在服务器随机生成，与 root 密码和 NameSilo Key 无关。导入链接也含有密码，应按密码处理。

服务以独立的 `hhikr-proxy` 系统账号运行，禁止该账号交互登录，只能读取其配置，并启用 `NoNewPrivileges`、`PrivateTmp` 和文件系统保护。软件包自带的默认 `shadowsocks-libev.service` 已停用，只运行本项目实例。

服务端的域名解析指定 `1.1.1.1`，不改系统的 `/etc/resolv.conf`。自检时，通过默认解析器访问本站出现证书验证失败；指定此解析器后通过。该设置只影响代理服务；如果以后此 DNS 不可达，可调整 systemd 的 `-d` 参数后重新验证。

## 安装复现

脚本用于本项目的新代理实例，已有配置时会停止，避免覆盖密码。它会停用软件包自带的默认实例，不应直接用于承载其他 Shadowsocks 服务的机器。

本机仅上传脚本并连接 SSH：

```powershell
scp -P 17648 tools/deploy/setup-proxy.sh tools/deploy/verify-proxy.py root@89.34.227.228:/root/
ssh -p 17648 root@89.34.227.228
```

在 VPS 执行：

```sh
bash /root/setup-proxy.sh
python3 /root/verify-proxy.py
```

脚本见 [setup-proxy.sh](setup-proxy.sh) 和 [verify-proxy.py](verify-proxy.py)。软件来自 Debian 仓库。当前 VPS 没有 nftables 过滤规则；以后增加防火墙时，要允许 TCP/UDP 24443，并保留网站和 SSH 端口。

下载私密配置只传输文件，不会启动本机代理：

```powershell
# 首次下载时 .deployment/proxy 应不存在，scp 会创建该目录。
scp -r -P 17648 root@89.34.227.228:/root/hhikr-proxy-private .deployment/proxy
```

## 验证范围

验证脚本只在 VPS 启动临时 `ss-local`，监听 `127.0.0.1:19080` 和 `127.0.0.1:19081`，结束后关闭进程并删除临时配置。检查加密 TCP 转发、HTTPS 证书验证、出口 IPv4、网站访问、错误密码拒绝和 UDP DNS 转发，不输出真实密码。

这些检查证明代理自身可转发请求，但使用的是 VPS 回环连接，不能证明公网 24443 入站或大陆到该端口的可达性。电脑连接、客户端兼容性和大陆线路没有测试。代理也不能保证第三方服务允许该 IP 或账号登录。

2026 年 10 月 9 日自检结果：TCP HTTPS、出口 IPv4 `89.34.227.228`、本站访问、错误密码拒绝和 UDP DNS 均通过，临时客户端已退出。原始结果保存在私密导出的 `verification.json`。

## 以后由你手动连接电脑

等电脑上的任务结束后，可在兼容 Shadowsocks 的客户端导入 `connection.txt` 的 `ss://` 链接。Mihomo 用户可合并节点片段到已有配置的 `proxies` 列表，并加入需要的代理组；节点片段不能单独替代完整客户端配置。

- 指定程序代理：只给某个程序配置客户端提供的 HTTP/SOCKS 端口，影响范围较小。
- 系统代理：让遵循系统代理设置的应用使用代理，并非所有应用都遵循。
- TUN：接管更多流量，通常需要管理员权限，会改变电脑网络状态。

以上方式本次均未启用。`client.json` 的 10808 是预备本地 SOCKS 端口；文件存在不代表电脑正在监听。必须配置客户端后，电脑才能使用 VPS 转发流量。

## 维护、停用与密码轮换

在 VPS 检查：

```sh
systemctl status hhikr-proxy --no-pager
systemctl is-enabled hhikr-proxy
journalctl -u hhikr-proxy --no-pager -n 50
ss -lntup | grep ':24443'
python3 /root/verify-proxy.py
```

临时停止或启动用 `systemctl stop hhikr-proxy`、`systemctl start hhikr-proxy`。停止并关闭开机启动用 `systemctl disable --now hhikr-proxy`；恢复用 `systemctl enable --now hhikr-proxy`。这些命令不影响 Caddy。

轮换密码时编辑 `/etc/hhikr-proxy/config.json` 的 `password`，保留足够长度的随机密码，再执行 `systemctl restart hhikr-proxy`。同步更新客户端和私密导出，旧导入链接即失效。不要重跑安装脚本轮换密码，它会因配置已存在而停止。

参考：[Debian 软件包](https://packages.debian.org/stable/net/shadowsocks-libev)、[Shadowsocks 配置](https://github.com/shadowsocks/shadowsocks-org/blob/main/docs/doc/configs.md)、[服务端手册](https://manpages.debian.org/unstable/shadowsocks-libev/ss-server.1.en.html)。
