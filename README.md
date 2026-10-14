# hhikr-moe：网站与 Cosmo 的统一源码仓库

本仓库收纳 [hhikr.moe](https://hhikr.moe)、Hermes/Cosmo 前后端、Android、任务系统和本机执行端。`main` 是统一开发基线；原 `redesign/endfield` 与源码迁移分支的历史保留，不再分别维护同一功能的另一份开发源码。

## 从这里开始

| 要做的事 | 先读 | 修改位置 |
| --- | --- | --- |
| 网站页面、登录、文章、评论、管理后台 | [网站说明](docs/SITE.md) | `src/`，网站脚本在 `scripts/` |
| Cosmo 聊天界面、触屏、浏览器桥接 | [代码地图](docs/PROJECT_MAP.md)、[Cosmo](tools/cosmo/README.md) | `tools/hermes/source/apps/desktop/`、`tools/cosmo/shim/` |
| Hermes 管理页 `/admin/` | [Hermes](tools/hermes/README.md) | `tools/hermes/source/web/` |
| 助手后端、Telegram 和定时卡片 | [代码地图](docs/PROJECT_MAP.md) | `tools/hermes/source/` |
| 任务、规则、设备状态接口 | [任务/Android 入口](tools/cosmo-runtime/README.md) | `tools/cosmo-runtime/state/plugins/cosmo-tasks/` |
| Android | [任务/Android 入口](tools/cosmo-runtime/README.md) | `tools/cosmo-runtime/workspace/phone-control/android/` |
| Windows 连接器、Java 执行端 | [代码地图](docs/PROJECT_MAP.md) | `tools/hermes/windows-bridge/`、`tools/hot100-java/` |
| 找配置、数据、签名或登录状态 | [配置与数据](docs/CONFIGURATION.md) | 仓库外，按下文机器分工定位 |
| 发布、回滚、清理 VPS | [VPS 运维](docs/VPS_RUNBOOK.md) | 对照实际服务与目录后执行 |

## 代码与机器分工

```text
src/ + public/ + scripts/ + tests/          网站
 tools/hermes/source/                      Hermes 完整前后端、Telegram 定制
 tools/cosmo/                              网页适配与现有 gate
 tools/cosmo-runtime/                      Android、任务插件、运动/作息脚本
 tools/hermes/windows-bridge/              Windows MCP 连接器
 tools/hot100-java/                        算法区本机 Java 执行端
 docs/                                    项目导航、配置、运行和验收说明
```

Windows 默认源码目录为 `C:\Users\<user>\Downloads\hhikr-moe`，测试、网站/前端构建、Android 构建都在 Windows 进行。`.worktrees/` 只是同一仓库的隔离工作目录，不是第二套项目。

`C:\Users\<user>\Downloads\hermes-dev\opt\hermes-hhikr` 保留本机工具链、原签名、外部规则和历史开发快照。现行源码以本仓库为准；本机快照不作为真实任务结果。

VPS 承载生产网站、Cosmo gate、Hermes 网页后端、Telegram 网关、cron、模型登录和真实任务数据。VPS 的运行源码/发布副本不能因“GitHub 上也有源码”就被当作冗余删除。

## VPS 文件位置与含义

| 路径 | 用途 |
| --- | --- |
| `/srv/hhikr/app/current` | 网站当前发布入口，指向具体 release |
| `/srv/hhikr/data/` | 网站生产数据库、上传和生成的数据 |
| `/etc/hhikr-web/env` | 网站生产环境变量与凭据，服务启动时读取 |
| `/srv/cosmo/current` | Cosmo 当前网页与 gate 发布入口 |
| `/etc/cosmo-gate/env` | gate 的生产环境变量与内部连接配置 |
| `/opt/hermes-hhikr/source/` | 当前 Hermes 运行源码；`.hermes/bin/hermes` 是服务启动入口 |
| `/opt/hermes-hhikr/state/` | Hermes home：配置、登录、会话、记忆、技能、cron 和日志 |
| `/opt/hermes-hhikr/windows-connection.env` | VPS 到 Windows 连接的私有环境配置 |
| `/opt/hermes-hhikr/workspace/` | 运动、作息、任务实例、设备状态及共享交接的权威运行记录 |
| `/etc/caddy/` | HTTPS 与反向代理配置 |

主要服务是 `hhikr-web.service`、`cosmo-gate.service`、`hermes-hhikr.service`（网页后端）和 `hermes-hhikr-gateway.service`（Telegram/调度）。具体环境变量、数据文件和服务端口见配置文档与运维文档。

## 配置分层与 GitHub 边界

仓库保留代码、变量名、配置加载器、接口、公开站点信息、构建配置、依赖锁文件、许可证、测试和合成样例。实际个人配置、规则参数、登录、凭据、签名、运行数据和部署产物放在外部。

`tools/cosmo-runtime/state/` 存的是插件/脚本源码；`tools/cosmo-runtime/tests/rules.synthetic.json` 是测试样例。它们都不是你的真实状态或规则。读取数据前先确定机器，避免把 Windows 快照覆盖到 VPS。

`tools/deploy/` 和 `.deployment/` 是本机私有部署材料，Git 忽略。`task.md`、`telegram-test-hello.txt`、`.worktrees/` 也保留在本地，不随提交上传。目录和提交边界的详细分类见 [配置与数据](docs/CONFIGURATION.md)。

## 开发、测试与构建入口

在仓库根目录执行。首次安装依赖会改变开发环境，按实际授权进行；网站使用根 `package-lock.json`，Hermes 使用其自身的依赖清单。全后端依赖与模型登录按 Hermes 上游文档准备，测试依赖不等于完整后端环境。

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 网站开发，默认 `http://localhost:4321` |
| `npm run test:server` | 网站服务端及离线 DNS 工具测试 |
| `npm run test:cosmo` | gate 网页登录、转发、来源与会话测试 |
| `npm run test:cosmo:native` | Android 原生登录到实际任务处理器的本地链路测试 |
| `npm run test:runtime` | 合成规则/临时数据的任务、Telegram、记录与检查工具测试 |
| `npm run test:android` | 合成规则下的 Java/权限检查；需外部 Android 工具链 |
| `npm run test:hot100` / `npm run test:hot100:java` | 算法、动画和 Java 实际编译运行 |
| `npm run build` | 网站类型检查、Astro 构建和搜索索引 |
| `npm run cosmo:build` | Cosmo 聊天渲染层，输出到忽略的 `.deployment/hermes/cosmo-web/dist/` |
| `npm --prefix tools/hermes/source/web run build` | 管理页，输出到 Hermes `hermes_cli/web_dist/` |
| `npm run hermes:cli -- --help` | 本仓库 Hermes CLI，使用搬迁路径入口 |
| `npm run android:build` / `npm run android:verify` | 外部个人规则与原密钥下构建/验签，产物不提交 |
| `python tools/cosmo-runtime/verify_sources.py` | 核对原源码来源、目标和审核后的文本摘要 |

Android/任务代码通过 `COSMO_DATA_ROOT`、`COSMO_RULES_FILE`、`COSMO_TOOLCHAIN_PATHS`、`COSMO_SIGNING_DIR` 定位外部文件，Hermes 用 `HERMES_HOME`。设置方式见 [配置与数据](docs/CONFIGURATION.md)。

## 给继续工作的 agent

1. 先读本页，再按任务进入专题文档；查实际代码，不把历史验收报告当作当前状态。
2. 先核对 `git status`、当前分支和工作目录，保留未提交的用户工作。开发默认在 Windows。
3. 运行配置、签名和实时数据在外部；需要其中的值时仅取任务所需内容，不输出秘密。
4. 发布前比较 VPS 最新文件及运行版本。Git push 只同步 Git；现有 GitHub workflow 仅测试/构建，不部署。
5. 系统、凭据、服务、提醒/权限规则的修改，以及生产发布和大范围清理，先说明具体目标、影响与恢复办法并取得批准。

[源码迁移历史](docs/SOURCE_MIGRATION.md) 保留当时的来源与验收；当前工程结构以本页和专题文档为准。Hermes 官方参考：<https://hermes-agent.nousresearch.com/docs/>。
