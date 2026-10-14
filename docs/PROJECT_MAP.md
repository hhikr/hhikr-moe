# 代码地图与调用关系

入口：[README](../README.md)。本页列当前源码位置；部署副本见 [VPS 运维](VPS_RUNBOOK.md)，配置与真实数据见 [配置与数据](CONFIGURATION.md)。

## 网站

| 路径 | 责任 |
| --- | --- |
| `src/pages/`、`src/components/`、`src/layouts/`、`src/styles/` | Astro 页面、组件、布局和样式 |
| `src/server/` | 网站数据库、账号、内容、统计、备份与 Hermes/Cosmo 对接 |
| `src/pages/api/auth/cosmo*` | 主站现有 Cosmo 授权入口；具体路由查目录中的实际文件 |
| `src/site.config.ts`、`src/data/changelog.ts` | 公开站点信息与沿革 |
| `scripts/`、`tests/server/` | 内容/构建/运维辅助与服务端测试；DNS 工具测试只用离线样例 |
| `src/content/posts/` | 数据库迁移前文章原件；生产文章在数据库中 |

## Hermes 与 Cosmo

| 路径 | 责任 |
| --- | --- |
| `tools/hermes/source/hermes_cli/` | CLI、Web/API 后端；`web_server.py` 保留现有鉴权 |
| `tools/hermes/source/agent/`、`tools/hermes/source/gateway/` | 助手执行与消息网关 |
| `tools/hermes/source/apps/desktop/src/` | 聊天界面主体，包含浏览器/触屏分支 |
| `tools/hermes/source/web/src/` | Web 管理页源码 |
| `tools/cosmo/build.mjs`、`tools/cosmo/patches.mjs` | 构建网页版聊天并应用现有适配 |
| `tools/cosmo/shim/` | 浏览器桥接、触屏交互和网页样式 |
| `tools/cosmo/gate/` | 现有登录、网页和接口转发；`native.mjs` 与 `association/` 是 Android 登录所需整组文件 |
| `tools/hermes/source/plugins/platforms/telegram/` | Telegram adapter、卡片、回调及 `task_store.py` |
| `tools/hermes/source/tools/send_message_senders.py` | 独立发送路径；与实时 adapter 使用同一卡片协议 |

## 任务与 Android

| 路径 | 责任 |
| --- | --- |
| `tools/cosmo-runtime/state/plugins/cosmo-tasks/dashboard/api.py` | rules、tasks、device-status、sleep/report 等现有接口 |
| `tools/cosmo-runtime/state/plugins/cosmo-tasks/dashboard/dist/index.js`、`tools/cosmo-runtime/state/plugins/cosmo-tasks/dashboard/manifest.json` | 手写管理页插件和清单；这里的 JS 是源码，不是可随意删除的构建垃圾 |
| `tools/cosmo-runtime/state/scripts/activity_*.py`、`tools/cosmo-runtime/state/scripts/sleep_daily.py` | 运动/作息阶段选择、提醒与持久化逻辑 |
| `tools/cosmo-runtime/workspace/phone-control/policy.py` | 手机限制的规则计算；设备实际执行由 Android 完成 |
| `tools/cosmo-runtime/workspace/phone-control/android/src/` | Android Java 客户端；包名、原签名和升级兼容性保留 |
| `tools/cosmo-runtime/workspace/phone-control/android/build.py`、`tools/cosmo-runtime/workspace/phone-control/android/test_release.py`、`tools/cosmo-runtime/workspace/phone-control/android/generate_parameters.py` | Android `src/` 的同级文件；负责构建、Java 检查和构建本地参数类生成 |
| `tools/cosmo-runtime/hermes_paths.py`、`personal_parameters.py`、`run.py` | 迁移路径、外部参数加载和 Python 开发入口 |
| `tools/cosmo-runtime/SOURCE_MANIFEST.json`、`ADAPTATIONS.json` | 原源码来源、目标、排除项、归一行尾的摘要与修改理由 |

`state/`、`workspace/` 在这个源码目录中保留原层级；真实状态在 `COSMO_DATA_ROOT`，不在上述源码子目录里。测试使用合成 JSON；构建本地生成的 `PersonalRules.java` 和 APK 被 Git 忽略。

## 执行端

- `tools/hermes/windows-bridge/`：Windows MCP 文件/命令/浏览器连接器。运行副本和凭据另放本机 `.deployment/hermes/windows-bridge/`；修改源码不等于修改正在运行的副本。
- `tools/hot100-java/`：用户电脑上的 Java 编译执行服务，网站不提供公共代码执行接口。

## 完整调用链

主站登录 → Cosmo gate → 聊天静态页 / Hermes API / `/admin/` 管理页。Android 经系统浏览器完成同站登录，用已有 PKCE/App Link 返回，再访问已有任务接口。gate 负责外部会话与转发，Hermes 负责助手和后端，任务插件负责任务/规则/设备接口。

Telegram 实时 adapter 和独立 sender 均使用 `CHRONOS_TASK_CARD_V1`。任务插件与 Telegram 共用外部逐日记录；运动与作息是不同实例。修改卡片/按钮时同时测试两条发送路径，不凭消息发送成功判定任务完成。

主模型、身份、工具授权、实际提醒配置属于外部运行配置。源码里的上游示例和项目开发文档不能代替正在运行的个人配置。
