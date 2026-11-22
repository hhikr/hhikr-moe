# Hot 100 判题服务上线

判题服务 `hot100-judge.service` 和网站在同一台 VPS 上，监听 `127.0.0.1:4310`，Caddy 把 `https://hhikr.moe/api/hot100/*` 转给它。服务做三件事：

- 编译运行读者的 Java（常驻 javac，每次运行在 bubblewrap 沙箱里启动一个 JVM）
- 隐藏用例判题
- JDT LS 智能提示

原理和环境变量见 `../server.mjs` 文件头和 [docs/SITE.md](../../../docs/SITE.md)。

按 [docs/VPS_RUNBOOK.md](../../../docs/VPS_RUNBOOK.md)，下面每一步改生产，执行前都要站长批准。

## 资源

| 项目 | 值 |
| --- | --- |
| 账号 | `hot100`（系统账号，无登录） |
| 发布 | `/srv/hot100/releases/<UTC 时间>/`，`/srv/hot100/current` 指向当前发布 |
| 环境变量 | `/etc/hot100/env`（root:hot100 640，没有秘密） |
| 运行目录 | `/var/lib/hot100`（StateDirectory，编译产物和 JDT LS 工作区，启动时重建） |
| JDT LS | `/opt/hot100/jdtls-1.63.0`，`/opt/hot100/jdtls` 链接到它；SHA-256 写在 `setup-hot100.sh` |
| 依赖 | `openjdk-25-jdk-headless`、`bubblewrap`（VPS 上都已安装），Node 用网站同一份 `/usr/local/bin/node` |
| 内存 | 服务上限 1300M（JDT LS 约 600M，常驻 javac 约 200M，单个程序 JVM 最多约 300M）；建议 swap 扩到 2G |

## 上线步骤

在本机：

```powershell
npm run test:hot100
npm run judge:package          # 生成 .deployment/hot100-judge.tar.gz
```

把 `.deployment/hot100-judge.tar.gz` 以及 `deploy/` 里的 `hot100-judge.service`、`setup-hot100.sh`、`install-hot100.sh` 上传到 VPS 的 `/root/hot100/`，然后在 VPS 上：

```sh
cd /root/hot100
SWAP=2G sh setup-hot100.sh                   # 账号、目录、env、JDT LS、systemd 单元；不启动服务
sh install-hot100.sh hot100-judge.tar.gz     # 新发布 → current → 重启 → 等健康检查，失败自动退回
```

然后把 `Caddyfile.snippet` 加进 `/etc/caddy/Caddyfile` 的 `hhikr.moe` 块，放在 `handle @static` 之前（本机私有的 `tools/deploy/Caddyfile` 已加好）。改之前先备份成 `Caddyfile.before-hot100`，再执行：

```sh
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

网站本身需要用新构建重新发布：练习页改成了在线判题，旧页面里的本机 JDK 入口已经去掉。

## 验收

- 服务健康：`curl -s 127.0.0.1:4310/api/hot100/health`。`language` 先显示 `starting`，几秒后变成 `ready`。之后 JDT LS 在后台预热约 60 秒，这段时间里第一次悬停在 JDK 类型上会慢一些。
- 题目页“动手写代码”：
  - 运行起始代码，显示 `UnsupportedOperationException` 和对应行号。
  - 换成参考解法后，运行和提交都通过。
  - 输入 `map.` 出现补全，写错类型出现红色波浪线。
- 沙箱：`tests/hot100/verify-judge-java.mjs` 的断网和文件隔离检查。可以在服务器上用 `HOT100_SANDBOX=bwrap` 跑这个测试。
- 内存：`systemctl show hot100-judge -p MemoryCurrent -p MemoryPeak`。

## 回滚与清理

```sh
sh install-hot100.sh --rollback   # 切回上一个发布
systemctl disable --now hot100-judge   # 完全停用；页面上的运行/提交会显示“判题服务暂时不可用”
sh install-hot100.sh --prune      # 另行批准后：只保留最新的三个发布
```

去掉 Caddy 里的 `handle /api/hot100/*` 块并 reload，接口就不再对外开放。

## 实测记录（2026-11-22）

以下都在 VPS 上用临时目录和临时 systemd 单元完成，测完已删除：

- JDK 25 和 bubblewrap 0.12 下，989 组隐藏用例全部被参考解法通过；断网、文件隔离、死循环、`System.exit`、栈溢出都按预期处理。
- 临时单元用了与 `hot100-judge.service` 相同的加固选项。运行、提交、沙箱和补全都通过，常驻内存约 560 MB。
- 加固选项里有两项会让 bubblewrap 失败，所以单元里没有设：
  - `RestrictSUIDSGID`（`DynamicUser` 默认带上它）会让 bubblewrap 报 “Can't open source /usr: Function not implemented”。
  - `ProtectHostname` 和其他挂载选项同时使用时，会让 bubblewrap 报 “Can't mount proc”。
- 当天 VPS 的 UDP 53 出站不通，DNS 解析失败，TCP 正常。如果上线时还是这样，`setup-hot100.sh` 下载 JDT LS 会失败。可以先修好 DNS，也可以按 SHA-256 手动放好 `/opt/hot100/jdtls-1.63.0`。

## 上线记录（2026-11-22）

- 判题服务发布 `20261122T110113Z`。因为 VPS 的 DNS 不通，JDT LS 先用 `curl --resolve` 下载并核对 SHA-256 放好，再运行 `setup-hot100.sh`；swap 已扩到 2G。
- Caddy 改动前备份为 `/etc/caddy/Caddyfile.before-hot100`，和改动后只差 `handle /api/hot100/*` 这一块。
- 网站发布 `main-6eb881b6-hot100`：复制上一版 `main-0fd51227-prose`，只换 `dist` 和 package 文件，`node_modules` 仍链接到共享目录。上一版保留，可以切回。
- 发布后重建搜索索引失败：`scripts/rebuild-search.mjs` 需要 `src/server/posts.ts` 等文件，网站发布包里本来就没有，上一版也一样。所以仍在用 2026-11-14 的搜索索引。
- 线上验收：
  - 起始代码报出带行号的异常；参考解法提交 10/10 通过。
  - JDT 补全和实时报错正常，浏览器控制台没有错误。
  - 沙箱里不能联网，也看不到宿主文件。
  - 其他服务都在运行；判题服务约 610 MB。