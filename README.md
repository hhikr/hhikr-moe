# hhikr-moe：hhikr.moe 网站源码

本仓库是 [hhikr.moe](https://hhikr.moe) 的源码，包括网站和算法区的在线判题服务。原来的 Hermes/Cosmo 助手、Telegram 网关、任务系统、Android 应用和 Windows 连接器已经下线，源码不再保留在 `main`，需要时从 Git 历史中找回。

## 从这里开始

| 要做的事 | 先读 | 修改位置 |
| --- | --- | --- |
| 网站页面、登录、文章、评论、管理后台 | [网站说明](docs/SITE.md) | `src/`，网站脚本在 `scripts/` |
| Hot 100 判题服务 | [代码地图](docs/PROJECT_MAP.md) | `tools/hot100-judge/` |
| 找配置、数据或登录状态 | [配置与数据](docs/CONFIGURATION.md) | 仓库外，按下文机器分工定位 |
| 发布、回滚、清理 VPS | [VPS 运维](docs/VPS_RUNBOOK.md)、[网站发布包](docs/WEBSITE_RELEASE_RUNTIME.md) | 对照实际服务与目录后执行 |

## 代码与机器分工

```text
src/ + public/ + scripts/ + tests/          网站
 tools/hot100-judge/                       算法区在线判题与 Java 智能提示服务
 tools/hot100-java/                        判题用的 Java 输入输出辅助类
 docs/                                    项目导航、配置、运行说明
```

开发、测试和构建都在 Windows 上进行，源码目录为 `C:\Users\<user>\Downloads\hhikr-moe`。`.worktrees/` 只是同一仓库的隔离工作目录，不是第二套项目。

VPS 承载生产网站、判题服务和 Caddy。

## VPS 文件位置与含义

| 路径 | 用途 |
| --- | --- |
| `/srv/hhikr/app/current` | 网站当前发布入口，指向具体 release |
| `/srv/hhikr/data/` | 网站生产数据库、上传和生成的数据 |
| `/etc/hhikr-web/env` | 网站生产环境变量与凭据，服务启动时读取 |
| `/srv/hot100/current`、`/etc/hot100/env` | 判题服务发布入口与环境 |
| `/etc/caddy/` | HTTPS 与反向代理配置 |

主要服务是 `hhikr-web.service`、`hot100-judge.service` 和 `caddy.service`。具体环境变量、数据文件和服务端口见配置文档与运维文档。

## 配置分层与 GitHub 边界

仓库保留代码、变量名、配置加载器、接口、公开站点信息、构建配置、依赖锁文件、许可证和测试。实际配置、凭据、运行数据和部署产物放在外部。

`tools/deploy/` 和 `.deployment/` 是本机私有部署材料，Git 忽略。`.worktrees/` 也保留在本地，不随提交上传。

## 开发、测试与构建入口

在仓库根目录执行，依赖来自根 `package-lock.json`。

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 网站开发，默认 `http://localhost:4321` |
| `npm run test:server` | 网站服务端及离线 DNS 工具测试 |
| `npm run test:hot100` / `npm run test:hot100:java` | 算法、动画和 Java 实际编译运行 |
| `npm run build` | 网站类型检查、Astro 构建和搜索索引 |
| `npm run judge` / `npm run judge:package` | 本机运行判题服务 / 打包判题服务 |

## 给继续工作的 agent

1. 先读本页，再按任务进入专题文档；查实际代码，不把历史记录当作当前状态。
2. 先核对 `git status`、当前分支和工作目录，保留未提交的用户工作。开发默认在 Windows。
3. 运行配置和实时数据在外部；需要其中的值时仅取任务所需内容，不输出秘密。
4. 发布前比较 VPS 最新文件及运行版本。Git push 只同步 Git；现有 GitHub workflow 仅测试/构建，不部署。
5. 系统、凭据、服务的修改，以及生产发布和大范围清理，先说明具体目标、影响与恢复办法并取得批准。
