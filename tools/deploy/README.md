# hhikr.moe 部署与维护

本文记录 2026 年 10 月 9 日的实际部署。网站在本机构建，ByteVirt VPS 上的 Caddy 提供静态文件，NameSilo 管理域名解析。VPS 不需要运行 Node.js、Astro 开发服务器或 Java 编译服务。

## 1. 资源、端口与目录

| 项目 | 当前值 |
| --- | --- |
| 域名 / 注册商 | `hhikr.moe` / NameSilo |
| 主站 | `https://hhikr.moe/` |
| 别名 | `www.hhikr.moe`，301 跳转到主站，保留路径 |
| VPS / 主机名 | ByteVirt / `bbbqiotgb1.bytevirt.com` |
| IPv4 | `89.34.227.228` |
| 分配的 IPv6 | `2407:cdc0:d010:249d::`，本次未配置 AAAA |
| 系统 / 架构 | Debian 13.7 / x86_64 |
| 内存 / 磁盘 | 约 3922 MiB / 40 GB |
| SSH | `root`，TCP `17648`，密码登录 |
| Caddy 软件包 | `2.6.2-12+deb13u1` |
| 当前发布 | `/srv/hhikr/releases/20261009` |
| 网站入口 | `/srv/hhikr/current`，符号链接指向当前发布 |
| Caddy 配置 | `/etc/caddy/Caddyfile` |
| 首次配置备份 | `/etc/caddy/Caddyfile.before-hhikr` |
| Caddy 证书与状态 | `/var/lib/caddy/.local/share/caddy/`，由服务管理 |
| 本机项目 | `C:\Users\hhikr\Downloads\hhikr-moe` |

网站使用 TCP 80/443 和 HTTP/3 UDP 443。Caddy 管理接口 2019 只监听回环地址。独立代理使用 TCP/UDP 24443，详见 [服务器代理](proxy.md)。

密码和 API Key 不写入文档或源码。`.deployment/` 已从 Git 排除，用于私密配置、发布包与 DNS 快照；不要把它复制到 `dist/` 或服务器网站目录。

## 2. 本机准备、构建与上传

以下在项目目录的 PowerShell 执行。准备 Node.js、npm、Windows OpenSSH 的 `ssh` 和 `scp`，以及 `tar`。先记录运行环境，再按 lockfile 安装依赖。

```powershell
Set-Location C:\Users\hhikr\Downloads\hhikr-moe
node --version
npm --version
ssh -V
npm ci
npm run build
```

构建顺序是类型检查、Astro 静态构建、Pagefind 搜索索引生成。命令成功退出后才能上传 `dist/`。首次构建生成 153 个路由，其中有全部 100 道题；Pagefind 收录 124 个页面。如果修改本机 Java 服务，先运行 `npm run java:package` 更新下载包，再构建网站。

```powershell
New-Item -ItemType Directory -Force .deployment | Out-Null
tar -czf .deployment/hhikr-site.tar.gz -C dist .
Get-FileHash .deployment/hhikr-site.tar.gz -Algorithm SHA256
scp -P 17648 .deployment/hhikr-site.tar.gz root@89.34.227.228:/root/
scp -P 17648 tools/deploy/Caddyfile root@89.34.227.228:/root/hhikr.Caddyfile
ssh -p 17648 root@89.34.227.228
```

`scp -P` 使用大写 P，`ssh -p` 使用小写 p。密码在 OpenSSH 提示中输入，不放进命令行。首次连接应与服务商控制台核对 SSH 主机指纹。

## 3. 服务器准备与首次发布

以下在 VPS 的 Bash 执行。先检查系统、端口、磁盘和已有服务；在其他机器复用时不能直接覆盖现有网站。此次 VPS 没有已有网站。

```sh
cat /etc/os-release
uname -m
free -m
df -h /
ss -lntup
apt-get update
apt-get install -y caddy curl ca-certificates
```

不需要重装系统或修改 SSH 端口。若服务商有外部防火墙，需允许 TCP 80/443；HTTP/3 还需 UDP 443。此次检查时 nftables 规则集为空，没有启用新的全局防火墙策略。

首次发布使用以下目录。其他版本必须使用不同目录。

```sh
mkdir -p /srv/hhikr/releases/20261009
tar -xzf /root/hhikr-site.tar.gz -C /srv/hhikr/releases/20261009
chmod -R a+rX /srv/hhikr/releases/20261009
test -f /srv/hhikr/releases/20261009/index.html
test -f /srv/hhikr/releases/20261009/404.html
ln -s /srv/hhikr/releases/20261009 /srv/hhikr/current
cp -a /etc/caddy/Caddyfile /etc/caddy/Caddyfile.before-hhikr
install -m 0644 /root/hhikr.Caddyfile /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl enable caddy
systemctl reload caddy
```

[Caddyfile](Caddyfile) 是正式配置：主域名提供静态文件，启用 gzip/zstd；`/_astro/` 下带哈希的资源缓存一年；指定 HTML 页面要求重新验证缓存；不存在的路径返回自定义 404；`www` 永久跳转。

当前 Caddy 为 2.6.2，配置使用不带状态码参数的 `handle_errors { ... }`。不要直接替换成只适用于更新版本的写法。修改配置后先 validate，通过后再 reload。

## 4. NameSilo 域名与 DNS

在 Domain Manager 选择 `hhikr.moe`，检查 Nameservers。此次通过 NameSilo DNS API 修改记录，域名必须使用 NameSilo DNS 才能让这些记录影响公开解析。如果以后改用其他 DNS 提供商，应在新提供商管理解析。

| 类型 | 主机名 | 值 | TTL |
| --- | --- | --- | --- |
| A | `@`，主域名 | `89.34.227.228` | 3600 秒 |
| A | `www` | `89.34.227.228` | 3600 秒 |

此次移除了主域名和 `www` 各自重复的旧停放页 A 记录。没有添加 AAAA。IPv6 应先验证路由和网站监听，再添加解析，否则部分访问者可能连接失败。其他子域名、邮件 MX/TXT 和验证记录不属于此次迁移范围。

### API Key

登录 [NameSilo API Manager](https://www.namesilo.com/account/api-manager)，创建 API Key。密钥只展示一次，保存到本机 `.deployment/namesilo-key.txt`，仅保留密钥本身，不附加 Markdown、引号或说明。已有密钥不需重新创建。若设置 API 来源 IP 限制，应允许运行脚本时的实际出口 IP。

密钥丢失时重新生成；泄露时撤销旧密钥并更新本机文件。不要将 API Key 放进公开文档、截图或 Git。

### 查询和修改解析

在本机项目目录执行：

```powershell
node scripts/namesilo-dns.mjs list --key-file .deployment/namesilo-key.txt
node scripts/namesilo-dns.mjs point --key-file .deployment/namesilo-key.txt --ip 89.34.227.228
```

[DNS 脚本](../../scripts/namesilo-dns.mjs) 只迁移主域名和 `www` 的 A 记录；修改前保存完整记录快照到 `.deployment/namesilo-before-*.json`。发现目标已有 CNAME 或 AAAA 时停止，避免留下冲突目标。脚本不是通用 DNS 管理器。

此次迁移前快照为 `.deployment/namesilo-before-1791553385138.json`。回滚 DNS 时在管理页按快照恢复类型、主机名、值和 TTL；不要盲目复用旧 record ID，也不要删除后来新增的记录。

在 VPS 上检查公开 DNS，可避开电脑的缓存或代理合成地址：

```sh
curl -fsS 'https://dns.google/resolve?name=hhikr.moe&type=A'
curl -fsS 'https://dns.google/resolve?name=www.hhikr.moe&type=A'
```

A 记录应指向服务器。不同递归 DNS 的缓存更新时间不同，TTL 3600 秒不代表所有用户同时切换。看到旧地址时先判断 Nameservers 和缓存，不要反复修改已经正确的解析。

## 5. HTTPS、证书与续期

Caddy 根据配置中的域名自动申请和续期证书，需要公开 DNS 正确、80/443 可入站。不需要另外安装 Certbot 或设置续期 cron。

```sh
systemctl is-active caddy
systemctl is-enabled caddy
journalctl -u caddy --no-pager -n 80
curl -I https://hhikr.moe/
curl -I https://www.hhikr.moe/hot100/206/
```

首次部署中，DNS 缓存曾让证书申请暂时失败。确认公开 DNS 正确后可重启 Caddy 重新触发服务；不要频繁重启或删除证书目录。此次 Let's Encrypt 证书已签发并通过严格验证。

将 DNS 与网站服务问题分开排查时，可指定连接 IP，同时保留域名和证书验证：

```sh
curl --resolve hhikr.moe:443:89.34.227.228 -I https://hhikr.moe/
```

不要添加 `-k`，否则会掩盖证书问题。

## 6. 上线验收

此次检查了全部 100 个题目路由，以及首页、文章入口、搜索资源、动画脚本和样式、自定义 404、`www` 跳转与 Java 下载包。下载包 SHA-256 与本机一致。代理安装后的复查仅在 VPS 执行。

```sh
curl -fsS https://hhikr.moe/ -o /dev/null
curl -fsS https://hhikr.moe/hot100/206/ -o /dev/null
curl -fsS https://hhikr.moe/pagefind/pagefind.js -o /dev/null
curl -fsS https://hhikr.moe/hot100-assets/app.mjs -o /dev/null
curl -fsS https://hhikr.moe/hot100-assets/style.css -o /dev/null
curl -sS -o /dev/null -w '%{http_code}\n' https://hhikr.moe/deployment-check-missing-page/
curl -I https://www.hhikr.moe/hot100/206/
find -L /srv/hhikr/current/hot100 -mindepth 2 -name index.html | wc -l
sha256sum /srv/hhikr/current/hot100-java.zip
ss -lntup
```

预期不存在的路径返回 404；`www` 返回 301，Location 为主域名对应路径；题目文件数为 100。这些检查不能代替浏览器的动画交互检查，也不能证明中国大陆所有网络的连通性。

## 7. 日常发布与原子切换

按第 2 节在本机构建和上传。以下在 VPS 执行，发布目录每次唯一：

```sh
release_id=$(date -u +%Y%m%dT%H%M%SZ)
release_dir="/srv/hhikr/releases/$release_id"
mkdir "$release_dir"
tar -xzf /root/hhikr-site.tar.gz -C "$release_dir"
chmod -R a+rX "$release_dir"
test -f "$release_dir/index.html"
test -f "$release_dir/404.html"
readlink -f /srv/hhikr/current
ln -s "$release_dir" /srv/hhikr/current.next
mv -Tf /srv/hhikr/current.next /srv/hhikr/current
curl -fsS https://hhikr.moe/ -o /dev/null
```

执行前 `current.next` 应不存在；若残留，先用 `readlink` 核对来源和目标，再处理。`mv -Tf` 在同一文件系统内原子替换链接，旧目录保留。切换静态文件版本不用重启 Caddy。不要往当前目录直接覆盖上传，以免出现不完整版本。

## 8. 回滚与备份

新版本异常时切回已存在的旧目录。以下示例回滚首次发布：

```sh
test -f /srv/hhikr/releases/20261009/index.html
ln -s /srv/hhikr/releases/20261009 /srv/hhikr/current.next
mv -Tf /srv/hhikr/current.next /srv/hhikr/current
curl -fsS https://hhikr.moe/ -o /dev/null
```

分别保留源码与 lockfile、服务器发布目录和 Caddyfile、DNS 快照，以及私密凭据和代理配置。证书状态含私钥，不应复制到公开目录。服务器重建时按第 3—5 节恢复网站，再单独恢复代理。

旧发布目录方便回滚，但同一台 VPS 上的副本不能代替离线备份。本文没有配置自动异地备份。

## 9. 故障定位与功能边界

| 现象 | 检查 |
| --- | --- |
| SSH 连不上 | IP、17648、实例状态、外部防火墙；必要时用 ByteVirt 控制台恢复 |
| 仍显示停放页 | Nameservers、公开 A 记录、旧重复记录、DNS 缓存 |
| HTTPS 失败 | Caddy 日志、公开 DNS、80/443 入站；保留证书验证 |
| 403 或文件读不到 | `current` 目标、目录执行权限、文件读取权限 |
| 搜索资源 404 | 完整构建是否成功、是否上传 `dist/pagefind/` |
| 更新未生效 | 先核对 `current`，再查浏览器缓存 |
| Java 无法编译 | 用户本机 Node.js、JDK、本机 Java 服务及允许的网站来源 |
| 评论不可用 | 独立 Waline 服务 `waline-comments.hhikr.moe`，本次没有部署该后端 |

Java 在访问者本机执行，VPS 不公开代码执行接口。项目旧 `scripts/deploy.sh` 属于另一套 rsync 流程，不是此次上线方式，执行前必须核对其目标目录和参数。网站和代理各有独立的 systemd 服务。
