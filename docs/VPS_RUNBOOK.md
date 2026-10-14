# VPS 运行、发布与清理

入口：[README](../README.md)。本页描述实际运行拓扑和操作顺序；凭据值不写入 Git。发布记录应标明 main 提交、产物摘要、原/新发布入口与实际验收结果。旧迁移报告不是当前运行状态。

## 当前服务拓扑

| 服务 | 入口 / 运行目录 | 配置与数据 |
| --- | --- | --- |
| `hhikr-web.service` | Node `dist/server/entry.mjs`，`/srv/hhikr/app/current`，回环 4400 | `/etc/hhikr-web/env`；`/srv/hhikr/data/` |
| `cosmo-gate.service` | Node `gate/server.mjs`，`/srv/cosmo/current`，回环 4410 | `/etc/cosmo-gate/env` |
| `hermes-hhikr.service` | `/opt/hermes-hhikr/source/.hermes/bin/hermes dashboard`，回环 9119 | `HERMES_HOME=/opt/hermes-hhikr/state`；`/opt/hermes-hhikr/windows-connection.env` |
| `hermes-hhikr-gateway.service` | 同一 Hermes 启动器，`gateway run`；Telegram 与调度 | 同一 home 的运行配置、cron 与会话；`/opt/hermes-hhikr/windows-connection.env` |
| `caddy.service` | HTTPS/反向代理 | `/etc/caddy/` |

两个 Hermes 服务的工作目录为 `/opt/hermes-hhikr/workspace`。实际 ExecStart、环境文件和 current 目标以 `systemctl show`、`readlink -f` 核对，不从 Git 推断。

网站 release 在 `/srv/hhikr/app/releases/`，Cosmo release 在 `/srv/cosmo/releases/`。当前与回滚版本都应保留。Hermes 的 `/opt/hermes-hhikr/source/` 当前仍带上游 Git 元数据、启动器和依赖，这是运行副本，不是可以直接删除的旧开发副本。

## 发布准备

1. 在 Windows main 核对 clean status、提交与两条来源分支的祖先关系；按 [README](../README.md) 运行测试、网站、聊天前端及管理页构建。
2. 只打包明确的代码/构建产物，不打包 state、workspace 数据、工具链、登录或 Windows node_modules。
3. 比较 VPS 最新源码、依赖锁与运行版本。Linux 依赖若可复用就复用；若必须安装，说明具体生产依赖并取得批准。VPS 不重新做开发构建。
4. 列出服务、配置/源码目标、预计中断、回滚入口和清理清单，确认后才修改生产。
5. 保存原入口与所改文件的备份、摘要。不要顺便改代理、域名、用户或访问权限。

Cosmo 发布包必须整组含 `gate/server.mjs`、`auth.mjs`、`native.mjs`、`association/assetlinks.json` 与 `association/callback.html`，以及构建的 dist。只带两个 gate 文件会让原生登录消失。

## 切换与验收

网站/gate 使用新 release + 原子切换 current；失败切回原入口并重启对应服务。网站保留外部数据库和上传，不把新构建的开发数据带过去。部署权限只授予运行公开代码所需的读取能力，秘密文件仍留原处。

Hermes 后端/任务源码按实际差异清单同步，管理页产物来自 Windows 构建；保留 `.hermes` 启动器、依赖环境、home 与登录。若搬迁参数加载需要新增环境路径或插件/脚本链接，明确这些文件并取得批准，不改任务时间、规则数值或通知路由。

重启网站/gate会短暂影响访问；重启 Hermes 网页后端会短暂断开聊天，网关重启会影响 Telegram/调度。部署可能中断当前 agent，需先保存交接与回滚目标；如用独立维护任务，应明确授权并把结果保存在可重新读取的文件中。

验收至少包括：
- 网站 `/api/health`、主要页面、静态文件；进程 cwd 指向新 release。
- gate 匿名拒绝、管理页转发、原生 authorize/token 路由、association 与 Android 包名/公开签名。
- Hermes 回环健康、管理页资源与 API；必要的鉴权检查只输出结果，不输出 token/cookie/响应体。
- Telegram/调度服务正常，插件能加载；数据路径、现有 cron 定义及通知路由保持一致。不要通过触发额外通知来代替服务验收。

登录账号、Google 返回和手机实际限制，保留独立的用户验收记录；不要自动发起真实登录。

## 清理准则与具体候选

先核对大小、进程引用、脚本/服务依赖和是否有未归拢工作，再申请具体删除范围。优先清理旧开发工具链、缓存与无用构建，不删除运行源码、生产数据或可用回滚版本。

已发现的旧 VPS 开发候选是 `/opt/hermes-hhikr/workspace/phone-control/toolchain/` 和 `dev-tools/`；Windows 已承担 Android 工具链和开发工具。删除前仍要核对引用，备份/归档方案另行确认。

同目录的 `device-status.json`、下载接口使用的公开 APK、`android/signing/`、`codex-home/`，以及整个 `state`、任务 history/ledger，不属于可直接整目录清空的对象。旧 Android/backend 工作稿也须先区分签名、交接和独有源码。

不要直接运行带自动旧版本清理的发布脚本。原本机私有 `tools/deploy/release.sh`、`release-cosmo.sh` 会删除较早的 release；本次使用前需审查并将发布与清理分开。服务器部署脚本和 systemd 配置的变更须具体批准。

## 文档与秘密

本页公开路径、职责和流程；真实 env、服务秘密、签名、备份与私有部署材料在外部。服务同步完成不等于全目录迁移，也不会把 VPS 运行数据写回 GitHub。发布后更新实际记录，下一次先重新核对服务与文件。
