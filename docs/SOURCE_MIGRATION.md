# 统一源码仓库与搬迁验收

目标仓库为 `hhikr/hhikr-moe`。迁移分支 `chore/consolidate-source` 基于原网站 `redesign/endfield` 的 `569dd930`，完整保留原分支提交。原工作目录的未提交文件留在原处，迁移使用独立 worktree；没有重置或覆盖原分支。

## 目录与关系

| 位置 | 责任与入口 |
| --- | --- |
| `src/`、`scripts/`、`tests/` | 网站；`npm run dev`、`test:server`、`build` |
| `tools/hermes/source/` | 上游完整后端、Desktop 前端、Web 管理页；导入基线 `71d34bad1045610252eda02ee79549436896e784` |
| `tools/cosmo/` | Desktop 网页桥接和现有 gate；`npm run cosmo:build`、`test:cosmo` |
| `tools/hermes/source/plugins/platforms/telegram/` | 原有消息适配 + 任务卡片、实例记录、按钮回调 |
| `tools/hermes/source/tools/send_message_senders.py` | 原有独立定时发送路径，带同一任务卡片协议 |
| `tools/cosmo-runtime/state/plugins/cosmo-tasks/` | 原有任务、规则、设备状态、作息报告 API 和手写管理页 JS |
| `tools/cosmo-runtime/state/scripts/` | 运动、作息和编码测试脚本 |
| `tools/cosmo-runtime/workspace/phone-control/` | 原策略计算、Android、验证脚本与相关测试 |
| `tools/hermes/windows-bridge/` | Windows MCP 连接器源码；现有连接和权限代码保留 |
| `tools/hot100-java/` | 网页算法练习的本机 Java 执行端 |

主站沿用现有授权接口，把浏览器送回 Cosmo gate；gate 提供聊天网页、转发 Hermes 接口与 `/admin/` 管理页。Android 沿用系统浏览器、PKCE、固定 App Link 和已有任务接口；任务 API 与 Telegram 读取同一组外部逐日记录。没有迁入或应用历史 future-auth 补丁。

运行命令和外部字段见根 README、`tools/hermes/README.md`、`tools/cosmo/README.md` 和 `tools/cosmo-runtime/README.md`。`npm run hermes:cli -- <命令>` 使用仓库后端和搬迁路径；完整 Hermes 依赖按其上游说明准备。

## 两台机器

Windows 承载源码编辑、网站与 Hermes 前端构建、Python/Java 测试、Android 工具链和现有签名；本机连接器继续使用原外部配置。VPS 承载实际网站、gate、Hermes 主进程、模型登录、Telegram、cron 和实时反馈数据。

`COSMO_DATA_ROOT`、`COSMO_RULES_FILE`、`COSMO_TOOLCHAIN_PATHS`、`COSMO_SIGNING_DIR` 是搬迁入口；既有网站、gate、Hermes 的变量与读取方式保留。个人规则参数仅按本次批准从实际字面量提取；字段、状态判定和接口不重设计。

源码之外保留个人 state/settings/history/task-ledger/device-status、签名、工具链绝对路径、登录和连接凭据。测试参数与记录为合成数据。迁移提交不含 APK、数据库、私钥、个人规则 JSON、运行日志或构建产物。本次没有上线、重启服务或修改活动定时规则。

## 实际验收

以下命令在 Windows 的迁移 worktree 中执行。依赖复用原网站/Hermes 已安装的 `node_modules`，并在已批准的本机 Python 虚拟环境补装测试缺项；没有在 VPS 安装工具链或构建。

| 命令/检查 | 结果 |
| --- | --- |
| `npm run test:server` | 147 项通过 |
| `npm run test:cosmo` | 11 项通过 |
| `npm run test:cosmo:native` | 9 项通过，真实 gate 到实际鉴权函数/任务处理器 |
| `npm run test:runtime` | 33 项通过，包括 Telegram 实时卡片、独立发送、授权按钮、话题保持、运动/作息记录及匿名检查工具 |
| `npm run test:android` | 5 组 Java 和 2 项权限检查通过 |
| `npm run test:hot100` | 课程、算法、动画及输入边界全部通过 |
| `npm run test:hot100:java` | 100 题参考解法、100 题编辑器程序和 275 组边界实际编译运行通过 |
| `npm run build` | 网站类型检查、Astro 构建和 Pagefind 索引完成 |
| `npm run cosmo:build` | 聊天渲染层与桥接产物完成 |
| `npm --prefix tools/hermes/source/web run build` | Hermes 管理页完成 |
| `npm run hermes:cli -- --help` | 从统一源码运行 CLI 帮助成功 |
| 搬迁后的 Android `build.py` / `verify_artifacts.py` | 原外部密钥构建成功；v2/v3、包名、版本、权限、精确 App Link、旧 APK 升级证书核对通过 |
| `tests/verify_equivalence.py` | 原个人参数下，原/新 Python 34,569 次比较及 Java 230,400 组判断一致 |

任务 API 测试从本仓库的 `hermes_cli/web_server.py` 提取原函数，绕开全服务初始化；HTTP 集成使用实际 FastAPI 处理器和合成凭据。没有用自拟认证替换实际函数，也没有连接真实 Google 账号或改线上会话。

原迁移 worktree 曾放在 `node_modules/.cache/`，触发 Node 原生 TypeScript 禁止在依赖目录中去类型。实际迁移 worktree 改到网站项目 `.worktrees/cosmo-migration/` 后，147 项测试和构建通过。该目录不提交。

## 核对与后续开发

`tools/cosmo-runtime/SOURCE_MANIFEST.json` 记录 60 项源码来源及 3 项明确排除的历史暂存/未来认证测试。`ADAPTATIONS.json` 列出审核后的文本摘要和搬迁/参数提取理由，摘要将 CRLF 归一为 LF，适用于 Windows 与 VPS checkout。

多做的 `tools/cosmo-focus/` 认证和策略改造已移出迁移内容，在本机忽略的缓存目录归档。现有 gate、后端 owner 鉴权、接口字段、网站变量和连接器权限代码保持不变。后续在统一目录修改源码，配置与实时数据继续放外部；发布另按目标文件、影响和恢复办法批准。
