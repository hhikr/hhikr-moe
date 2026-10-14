# Hermes 源码与 Windows 连接器

本目录收纳统一源码仓库中的 Hermes 上游源码和 Windows 连接器源码。它们是 Windows 开发 checkout 的文件，不等于 VPS 上正在运行的副本。

| 路径 | 用途 |
| --- | --- |
| [`source/`](source/) | Hermes 后端、Desktop、Web 管理页、Telegram 网关等源码；导入来源见 [`source/HHIKR_SOURCE.json`](source/HHIKR_SOURCE.json) |
| [`windows-bridge/`](windows-bridge/) | Windows MCP 连接器源码；本机运行副本及其私有配置在仓库外 |
| [`../cosmo/`](../cosmo/README.md) | 浏览器桥接、Cosmo gate、触屏样式与构建适配 |
| [`../cosmo-runtime/`](../cosmo-runtime/README.md) | Android、任务插件与运行脚本源码 |

## 开发

先阅读 [`../../docs/PROJECT_MAP.md`](../../docs/PROJECT_MAP.md) 与 [`../../docs/CONFIGURATION.md`](../../docs/CONFIGURATION.md)，并遵循 `source/AGENTS.md` 及目标子目录中的 `AGENTS.md`。网站与 Hermes 前端各自使用仓库中的 Node 依赖；Hermes Python 环境依照上游项目说明准备。

Cosmo 网页构建从仓库根目录运行：

```powershell
npm run cosmo:build
```

Hermes Web 管理页构建从仓库根目录运行：

```powershell
npm --prefix tools/hermes/source/web run build
```

两者的产物是本地构建输出，不会自动部署到 VPS。主仓库的其他测试和构建入口见根 [`README.md`](../../README.md)。

Hermes 上游代码的许可证见 [`source/LICENSE`](source/LICENSE)；导入来源、版本及本仓库适配记录见 [`source/HHIKR_SOURCE.json`](source/HHIKR_SOURCE.json)。导入内容及本地适配应遵守该许可证和来源清单所列边界。

## Windows 连接器

`windows-bridge/` 包含连接器源码和依赖清单。本机运行副本、连接配置和凭据不在公开源码中；相关外部位置及边界见 [`docs/CONFIGURATION.md`](../../docs/CONFIGURATION.md)。不要把私有运行目录当作本仓库源码，也不要把本机源码修改当成运行副本已更新。

## VPS 运行副本

VPS 上的 Hermes 运行源码位于 `/opt/hermes-hhikr/source/`，带有上游 Git 元数据和 `.hermes/bin/hermes` 启动器。运行状态位于 `/opt/hermes-hhikr/state/`，共享任务数据位于 `/opt/hermes-hhikr/workspace/`。这套源码仍由 VPS 服务使用，不是可直接清理的旧开发目录。当前服务拓扑和发布边界见 [`docs/VPS_RUNBOOK.md`](../../docs/VPS_RUNBOOK.md)；本地历史迁移验收见 [`docs/SOURCE_MIGRATION.md`](../../docs/SOURCE_MIGRATION.md)，不代表当前部署状态。

Hermes 上游参考文档：<https://hermes-agent.nousresearch.com/docs/>。
