# hhikr.moe 部署与维护

网站在本机构建，部署到 ByteVirt VPS，NameSilo 管理域名解析。

**2026 年 10 月 11 日起，网站由常驻的 Node 服务加 Caddy 提供**：构建产物里已有的文件和预渲染页面由 Caddy 直接发送，其余请求转给监听 `127.0.0.1:4400` 的 Node 服务（`hhikr-web.service`）。日常发布和回滚见第 7、8 节。第 2、3 节记录的是 10 月 9 日首次部署静态站点的过程，其中的目录和上传命令已不是当前做法，保留作为历史和回滚参考。VPS 不运行 Java 编译服务。

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
| SSH | `root`，TCP `17648`，仅密钥登录（2026 年 10 月 11 日起禁用密码，配置在 `/etc/ssh/sshd_config.d/00-hhikr.conf`） |
| Caddy 软件包 | `2.6.2-12+deb13u1` |
| Node.js | `v24.19.0`，来自 nodejs.org 并核对过校验和，位于 `/opt/node-v24.19.0`，`/usr/local/bin` 下有链接。不随系统更新，需手动升级 |
| 服务 | `hhikr-web.service`，账号 `hhikr-web`，监听 `127.0.0.1:4400`，开机启动 |
| 环境变量 | `/etc/hhikr-web/env`，权限 640，以后存放密钥 |
| 发布目录 | `/srv/hhikr/app/releases/<UTC 时间戳>/`，内含 `dist/` 和 `node_modules/` |
| 网站入口 | `/srv/hhikr/app/current`，符号链接指向当前发布 |
| 数据目录 | `/srv/hhikr/data`，属于 `hhikr-web`，发布时不动（目前为空） |
| 旧静态站点 | `/srv/hhikr/releases/20261009` 和 `/srv/hhikr/current`，已不再使用，保留用于回滚 |
| Caddy 配置 | `/etc/caddy/Caddyfile` |
| 配置备份 | `/etc/caddy/Caddyfile.before-node`（静态站点时的配置）、`/etc/caddy/Caddyfile.before-hhikr`（最初的配置） |
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

`scp -P` 使用大写 P，`ssh -p` 使用小写 p。服务器只接受密钥登录，命令需加 `-i $env:USERPROFILE\.ssh\hhikr_vps`；密钥丢失时只能通过 ByteVirt 控制台进入服务器。首次连接应与服务商控制台核对 SSH 主机指纹。

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

仓库里的 [Caddyfile](Caddyfile) 现在是第 7 节所述 Node 服务的配置，不是本节首次部署时使用的那一份（那一份在服务器的 `/etc/caddy/Caddyfile.before-node`）。当时的配置：主域名提供静态文件，启用 gzip/zstd；`/_astro/` 下带哈希的资源缓存一年；指定 HTML 页面要求重新验证缓存；不存在的路径返回自定义 404；`www` 永久跳转。

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

在本机项目目录的 PowerShell 执行。构建产物分为 `dist/client/`（静态文件）和 `dist/server/`（Node 服务）。不要在 VPS 上构建。

```powershell
npm run build
tar -czf .deployment/hhikr-app.tar.gz dist package.json package-lock.json scripts src/server src/markdown src/plugins
scp -i $env:USERPROFILE\.ssh\hhikr_vps -P 17648 .deployment/hhikr-app.tar.gz tools/deploy/release.sh root@89.34.227.228:/root/
ssh -i $env:USERPROFILE\.ssh\hhikr_vps -p 17648 root@89.34.227.228 "sed -i 's/\r$//' /root/release.sh && sh /root/release.sh /root/hhikr-app.tar.gz"
```

压缩包里除了构建产物，还要带上 `scripts/` 和 `src/server`、`src/markdown`、`src/plugins`：服务器上的维护脚本（如重建搜索索引）直接运行这些源文件。

[release.sh](release.sh) 在服务器上完成其余步骤：解压到唯一的发布目录，检查关键文件，执行 `npm ci --omit=dev`，原子替换 `current` 链接，重启 `hhikr-web`，请求 `http://127.0.0.1:4400/api/health`，最后以 `hhikr-web` 身份重建搜索索引。健康检查失败时自动切回上一个发布并以非零状态退出；搜索索引重建失败只给出警告，旧索引保留。依赖必须在服务器上安装，因为 `sharp` 和 `pagefind` 带有与操作系统相关的二进制文件。

重启服务的一两秒内，Caddy 会让请求等待（`lb_try_duration 5s`）而不是报错。只改静态文件也要走这套流程。不要往当前目录直接覆盖上传。

发布后至少检查首页、一篇文章及其图片、`/hot100/206/`、`/api/health`、`/pagefind/pagefind.js`，以及一个不存在的地址返回 404。

### 数据目录

文章、媒体文件和搜索索引在 `/srv/hhikr/data`，**不属于发布内容，发布时不会改动**：

| 路径 | 内容 |
| --- | --- |
| `site.db`（及 `-wal`、`-shm`） | SQLite 数据库：文章、账号、评论和访问统计。启动时自动执行未执行过的结构迁移，迁移前会留一份 `site.db.before-<迁移名>` |
| `media/` | 文章图片和封面，按内容哈希存放，Caddy 直接从这里提供 `/media/*` |
| `avatars/` | 用户头像，由服务端重新编码成 256×256 的 WebP，Caddy 直接从这里提供 `/avatars/*` |
| `pagefind/` | 搜索索引，Caddy 直接从这里提供 `/pagefind/*`。发布时重建；在管理面板里发布、撤回或隐藏文章后约 15 秒由服务自己重建 |

目录属于 `hhikr-web`，权限 750；`caddy` 账号已加入 `hhikr-web` 组以便读取。10 月 11 日首次安装的数据来自本机 `npm run import:posts` 的结果（23 篇文章，其中 16 篇已发布、7 篇草稿）。**此后服务器上的数据库是唯一的正本，不要再用本机的 `.data/` 覆盖它。**

单独重建搜索索引：

```sh
runuser -u hhikr-web -- sh -c "umask 027; set -a; . /etc/hhikr-web/env; set +a; cd /srv/hhikr/app/current && node scripts/rebuild-search.mjs"
```

页面地址以斜杠结尾，不带斜杠的请求会被 301 到带斜杠的地址；接口（`/api/*`）和文件不受此限制。

### 环境变量与登录

`/etc/hhikr-web/env`（`root:hhikr-web`，权限 640）里除了监听地址和数据目录，还有登录需要的配置。修改后执行 `systemctl restart hhikr-web`。

| 变量 | 用途 |
| --- | --- |
| `SITE_ORIGIN` | `https://hhikr.moe`。决定 Cookie 是否带 `Secure`、请求来源校验和 Google 回调地址 |
| `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET` | Google 登录。本机副本在 `.deployment/google-oauth.json` |
| `ENDMIN_GOOGLE_EMAIL` | 首次用这个 Google 账号登录的人成为 endministrator；绑定之后只认 Google 账号编号，这一项不再起作用 |
| `BACKUP_REPO`、`BACKUP_GITHUB_TOKEN` | 备份仓库和只对它有效的访问令牌，见 8a 节 |
| `SECRET_KEY` | 签名和哈希用的密钥，在服务器上生成，只存在于这个文件。丢失或更换后，尚未使用的验证挑战和限速记录失效，已登录的会话不受影响 |

Google 无法访问时，生成一个五分钟内有效、只能用一次的 endministrator 登录链接：

```sh
runuser -u hhikr-web -- sh -c "set -a; . /etc/hhikr-web/env; set +a; cd /srv/hhikr/app/current && node scripts/endmin-login-link.mjs"
```

把打印出的地址粘贴到浏览器即可。链接等同于管理员身份，不要发给别人，也不要留在聊天记录或截图里。

首次搭建环境（安装 Node.js、创建账号和目录、安装服务）用 [setup-web.sh](setup-web.sh)，它需要 [hhikr-web.service](hhikr-web.service) 已上传到 `/root/`，可以重复执行。修改 Caddy 配置时上传 [Caddyfile](Caddyfile)，先 `caddy validate` 再 `systemctl reload caddy`。

## 8. 回滚与备份

新版本异常时切回已存在的旧发布目录：

```sh
ls /srv/hhikr/app/releases
ln -s /srv/hhikr/app/releases/<旧的发布编号> /srv/hhikr/app/current.next
mv -Tf /srv/hhikr/app/current.next /srv/hhikr/app/current
systemctl restart hhikr-web
curl -s http://127.0.0.1:4400/api/health/
```

Node 服务整体出问题时，可以退回 10 月 9 日的纯静态站点，它不依赖 Node：

```sh
cp -a /etc/caddy/Caddyfile /etc/caddy/Caddyfile.node
install -m 0644 /etc/caddy/Caddyfile.before-node /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

静态站点的内容停留在 10 月 9 日，仍含友链页面和 Google Analytics，7 篇草稿也仍然公开显示。它只是“Node 服务完全起不来”时的应急手段：此后在数据库里新写或修改的文章不会出现在里面。上一阶段（文章仍为静态页面）的 Caddy 配置另存为 `/etc/caddy/Caddyfile.phase2`。

回滚代码版本时注意数据库结构：新版本执行过的结构迁移不会随代码回退。回退到迁移之前的版本时，要同时用迁移前留下的 `site.db.before-<迁移名>` 替换数据库，并接受此后的数据改动丢失。

每个发布目录约 370 MB（主要是 `node_modules`）。`release.sh` 在发布成功后自动删除较旧的目录，只保留最新的三个。

分别保留源码与 lockfile、服务器发布目录和 Caddyfile、DNS 快照，以及私密凭据和代理配置。证书状态含私钥，不应复制到公开目录。服务器重建时按第 3—5 节恢复网站，再单独恢复代理。

旧发布目录方便回滚，但同一台 VPS 上的副本不能代替异地备份。异地备份见下一节。

## 8a. 备份到 GitHub 与恢复

每天新加坡时间凌晨 4 点，`hhikr-backup.timer` 运行 `node scripts/backup.mjs`，把数据备份到 GitHub 上的**私有**仓库（`/etc/hhikr-web/env` 里的 `BACKUP_REPO`）。管理面板的「备份」页显示状态和警告，也可以手动触发。

| 内容 | 去向 |
| --- | --- |
| 数据库 | 导出为文本 `export/db.sql` 后进 git。登录会话、限速记录、一次性链接、当天的访客标记、备份运行记录这几张表只导出结构，不导出数据 |
| 每篇文章 | 另存一份带 front matter 的 `export/posts/<地址>.md`，便于在 GitHub 上看修改历史 |
| `media/`、`avatars/` 中不超过 50 MB 的文件 | git |
| 超过 50 MB 的媒体文件、`files/` 下的全部文件 | 备份仓库的 Release 附件，按月一个 Release（`blobs-YYYY-MM`），附件名是文件的 SHA-256；对应关系记在数据库的 `backup_blobs` 表里 |
| 数据库文件本身、搜索索引、`tmp/`、`apps/` | 不备份，都能重建 |

做法上的几点：

- 备份仓库的 git 目录是 `/srv/hhikr/backup.git`，工作目录就是 `/srv/hhikr/data`，所以文件不会在磁盘上多存一份。数据目录里的 `export/` 和 `.gitattributes` 是备份生成的，不要删。
- 访问令牌是只对备份仓库有效的细粒度令牌（Contents 读写），存在 `/etc/hhikr-web/env` 的 `BACKUP_GITHUB_TOKEN`。它只通过环境变量传给 git，不写进仓库配置。更换令牌：把新令牌存成服务器上的一个文件，执行 `sh setup-backup.sh <所有者/仓库> <令牌文件>`，脚本写入后会删除该文件并重启服务。
- **每次备份先向 GitHub 确认仓库是私有的，不是就停止**，因为备份里有密码哈希、草稿和隐藏文章。不要把备份仓库改成公开。
- 首次配置用 [setup-backup.sh](setup-backup.sh)（安装 git、建目录、写环境变量、安装 [hhikr-backup.service](hhikr-backup.service) 和 [hhikr-backup.timer](hhikr-backup.timer)），需要先把这两个单元文件和 [hhikr-web.service](hhikr-web.service) 上传到 `/root/`。

手动备份和查看结果：

```sh
systemctl start hhikr-backup.service
journalctl -u hhikr-backup.service -n 20 --no-pager
systemctl list-timers hhikr-backup.timer
```

### 恢复

在一台装好 Node.js、git 并解压了网站发布包的机器上（新服务器按第 7 节和 `setup-web.sh` 准备）：

```sh
# 1. 把备份仓库克隆成新的数据目录（克隆时需要能读该私有仓库的凭据）
git clone https://github.com/<所有者>/<备份仓库>.git /srv/hhikr/data

# 2. 从导出文件重建数据库，并把 Release 附件下载回原位置，逐个核对 SHA-256
cd /srv/hhikr/app/current
BACKUP_REPO=<所有者>/<备份仓库> BACKUP_GITHUB_TOKEN=<令牌> node scripts/restore.mjs /srv/hhikr/data

# 3. 交给服务账号，启动，重建搜索索引
chown -R hhikr-web:hhikr-web /srv/hhikr/data && chmod 750 /srv/hhikr/data
systemctl restart hhikr-web
runuser -u hhikr-web -- sh -c "umask 027; set -a; . /etc/hhikr-web/env; set +a; cd /srv/hhikr/app/current && node scripts/rebuild-search.mjs"
```

`restore.mjs` 只接受还没有 `site.db` 的目录，不会覆盖现有数据库。恢复后所有人需要重新登录（会话不备份）；`/etc/hhikr-web/env` 不在备份里，其中的 Google 密钥在本机 `.deployment/`，`SECRET_KEY` 可以重新生成。要继续用恢复出来的目录做备份，把其中的 `.git` 移到 `/srv/hhikr/backup.git`。

10 月 11 日按这个流程演练过一次：克隆到空目录，重建出的数据库与线上逐表一致，媒体文件内容一致，两个测试附件（60 MB 和 110 MB）下载后哈希相符，用恢复出的目录启动的第二个网站实例可以正常打开文章、图片、RSS 和站点地图，并能重建搜索索引。

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
| 评论或登录不可用 | `systemctl status hhikr-web`、`journalctl -u hhikr-web -n 80`；评论和账号都在本机的 Node 服务里 |
| 访问统计不增加 | 爬虫、脚本和站长本人的访问本来就不计；其余情况看浏览器对 `/api/hit` 的请求是否返回 200 或 204 |

Java 在访问者本机执行，VPS 不公开代码执行接口。项目旧 `scripts/deploy.sh` 属于另一套 rsync 流程，不是此次上线方式，执行前必须核对其目标目录和参数。网站和代理各有独立的 systemd 服务。
