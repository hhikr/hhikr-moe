# 配置、数据与 GitHub 边界

入口：[README](../README.md)。规则：代码和加载逻辑留在 Git，实际个人值、凭据与运行数据留在外部。公开域名、包名、变量名、构建配置不是凭据；不要为搬迁重写接口或认证。

## 仓库内

| 文件/目录 | 含义 |
| --- | --- |
| `src/site.config.ts`、`astro.config.mjs`、`tsconfig.json` | 公开站点信息与项目构建配置 |
| 根 `package.json`、`package-lock.json` | 网站和统一开发入口、锁定的 Node 依赖 |
| `tools/hermes/source/pyproject.toml`、`uv.lock` | 上游 Hermes 依赖，独立于网站依赖 |
| Android Manifest、插件 manifest/plugin.yaml | 包、组件、权限和插件声明；保留现有关系 |
| `tools/cosmo-runtime/tests/rules.synthetic.json` | 合成测试规则和文案，不用于个人运营 |
| 源码中的环境变量读取、默认值和接口 | 程序逻辑；实际值由外部配置提供 |

## Windows 外部文件

原外部根为 `C:\Users\<user>\Downloads\hermes-dev\opt\hermes-hhikr`。这不是新的源码维护入口；下列路径相对于该根。

| 路径 | 用途 |
| --- | --- |
| `workspace/cosmo/source-migration.rules.json` | 原源码实际个人参数的外部文件 |
| `workspace/phone-control/toolchain/paths.json` | 本机 JDK、Android SDK/build tools 的绝对路径 |
| `workspace/phone-control/android/signing/` | 原 `release.jks`、密码文件；不创建新密钥、不上传 |
| `workspace/activity-coach/state.json`、`workspace/activity-coach/history/` | 运动状态与逐日历史的开发快照 |
| `workspace/sleep-plan/settings.json`、`workspace/task-ledger/` | 作息设置与任务实例的开发快照 |
| `workspace/phone-control/device-status.json` | 设备状态快照 |

本机连接器的实际配置在网站 `.deployment/hermes/windows-bridge/`，包含 `connection-private.json` 等私有文件。公开源码在 `tools/hermes/windows-bridge/`。读取/修改凭据或连接权限先按具体授权处理。

## 运行输入变量

| 变量 | 指向 | 使用者 |
| --- | --- | --- |
| `HERMES_HOME` | 外部 Hermes 配置/登录/状态目录；VPS 为 `/opt/hermes-hhikr/state` | Hermes |
| `COSMO_DATA_ROOT` | 外部数据根，保留原 `workspace/` 等层级 | 任务/规则代码 |
| `COSMO_RULES_FILE` | 仓库外实际规则 JSON | Python 规则/提醒与 Android 参数生成 |
| `COSMO_TOOLCHAIN_PATHS` | 外部 `paths.json` | Android 构建/测试/验签 |
| `COSMO_SIGNING_DIR` | 原外部签名目录 | Android 构建 |

后两项不设置时从外部数据根下的原位置找。测试入口强制合成规则；实际构建显式使用个人文件。它们是路径输入，不替代网站/gate/Hermes 原有变量。

网站和 gate 的现有变量保留：网站包括 `COSMO_ORIGIN` 与 `COSMO_GATE_SECRET`；gate 包括 `COSMO_LISTEN`、`COSMO_PUBLIC_ORIGIN`、`COSMO_STATIC_DIR`、`COSMO_HERMES`、`COSMO_AUTH`、`COSMO_SITE_PUBLIC`、`COSMO_SITE_INTERNAL`、`COSMO_GATE_SECRET`、`COSMO_RECHECK_MS`。详细语义见 [Cosmo 配置](../tools/cosmo/README.md)。不要把共享密钥写入本文或命令输出。

## VPS 权威数据与配置

| 位置 | 内容/所有者 |
| --- | --- |
| `/etc/hhikr-web/env`、`/etc/cosmo-gate/env` | 网站/gate 启动环境与生产凭据 |
| `/opt/hermes-hhikr/windows-connection.env` | Windows 连接环境，供 Hermes 服务加载 |
| `/opt/hermes-hhikr/state/config.yaml` | Hermes 非凭据设置，包括当前模型/功能配置 |
| `/opt/hermes-hhikr/state/.env`、`/opt/hermes-hhikr/state/auth.json` | 服务秘密与模型登录状态 |
| `/opt/hermes-hhikr/state/SOUL.md` 等实际规则文件 | 用户身份、行为与授权规则；不是上游示例 |
| `/opt/hermes-hhikr/state/` 的会话、记忆、技能、cron、日志 | 当前 profile 运行状态；部署不覆盖 |
| `/opt/hermes-hhikr/workspace/activity-coach/state.json`、`/opt/hermes-hhikr/workspace/activity-coach/history/` | 当前运动计划、实际反馈与逐日历史 |
| `/opt/hermes-hhikr/workspace/sleep-plan/settings.json` | 当前作息设置 |
| `/opt/hermes-hhikr/workspace/task-ledger/` | 作息等任务实例 |
| `/opt/hermes-hhikr/workspace/phone-control/device-status.json` | 当前设备上报；同目录公开 APK 可供既有下载接口使用 |
| `/opt/hermes-hhikr/workspace/cosmo/CONVENTIONS.md`、`/opt/hermes-hhikr/workspace/cosmo/HANDOFF.md` | 私有共享约定与工作交接 |
| `/srv/hhikr/data/` | 网站数据库、上传与生产内容 |

VPS 当前任务、反馈、设备和会话以这些运行文件为准；Windows 副本仅供开发。存反馈可按现有规则进行，新增/停用或改变规则需单独批准。

## 已提交 / 未提交

提交：完整项目源码、既有接口、配置加载器、公开构建配置、依赖锁、许可证、源码来源清单、合成测试与项目文档。上游 Hermes 的示例/开发说明保持其原用途，不作为个人运行规则。

不提交：个人规则 JSON、state/settings/history/task-ledger/device-status、数据库/上传、登录/token、密钥/密码/证书私钥、连接私有配置、工具链路径文件、依赖目录、APK、生成参数类、发布包与运行日志。

`.deployment/`、`tools/deploy/`、`.data/`、`node_modules/` 和生成目录均由 Git 忽略。`tools/cosmo-runtime/state/plugins/cosmo-tasks/dashboard/dist/index.js` 是已跟踪的手写插件源码，不能因目录叫 dist 就排除。最终以 `git ls-files` 和实际提交清单核对。

## 查询与修改顺序

1. 明确需要源码、开发快照还是生产记录，先选机器。
2. 定位文件/环境变量；必要时只读字段或元数据，不输出秘密值。
3. 修改源码用测试数据；发布前再次比较最新运行文件和依赖。
4. 把具体配置变更、服务影响、恢复办法提交用户确认，再写入生产或权限配置。
5. 只同步明确清单。不要整目录复制 `hermes-dev`、`state` 或 `workspace` 到 VPS。
