# Hermes 本地源码

此目录收纳原网站项目 `.deployment/hermes/` 中的 Hermes 前后端及 Windows 连接器源码。Cosmo 网页适配保留在 `tools/cosmo/`。所有源码直接保存在 `hhikr-moe`，不使用 submodule 或个人 fork。

| 位置 | 原本地位置 | 内容 |
| --- | --- | --- |
| `source/` | `.deployment/hermes/upstream/` | Hermes 前后端完整源码，来源提交见 `source/HHIKR_SOURCE.json` |
| `source/apps/desktop/src/` | 上述源码中的同名目录 | Cosmo 复用的 Desktop 前端 |
| `source/web/` | 上述源码中的同名目录 | Web 管理界面 |
| `source/hermes_cli/`、`source/agent/`、`source/gateway/`、`source/tui_gateway/` | 上述源码中的同名目录 | 服务接口、助手执行和消息网关 |
| `windows-bridge/` | `.deployment/hermes/windows-bridge/` | Windows 文件、进程与浏览器 MCP 连接器及审批页面 |
| `../cosmo/` | `tools/cosmo/` | 网页桥接、登录网关、触屏样式和构建补丁 |

## 开发

后续直接修改上述源码。修改前阅读对应目录的 `AGENTS.md`。网站、Hermes 和 Windows 连接器分别安装依赖。

```powershell
npm --prefix tools/hermes/source ci --workspace apps/desktop --include-workspace-root --ignore-scripts
npm run cosmo:build
```

构建产物仍保存在 `.deployment/hermes/cosmo-web/dist/`。`cosmo/build.json` 的 `hermesCommit` 记录上游导入基线；后续修改由本仓库提交记录标识。前后端发布需要保持接口版本兼容。

## Windows 连接器

```powershell
npm --prefix tools/hermes/windows-bridge ci
node tools/hermes/windows-bridge/setup.mjs
node tools/hermes/windows-bridge/bridge.mjs
```

安装脚本生成本机凭据和配置，不覆盖已有凭据。默认授权根目录是网站项目。`verify.mjs` 检查已运行连接器的认证、文件边界与审批；`verify-development.mjs` 需要另行配置原有 VPS 路径映射，只用于该开发环境。

## 导入边界与许可证

保留 `source/LICENSE`、原版权声明和各组件许可证。Hermes 根许可证为 MIT，允许修改和分发；依赖和素材按各自许可证处理。

没有导入 `.git`、依赖、构建产物、连接凭据、审批状态、日志、数据库、迁移备份或签名材料。`Downloads/hermes-dev/` 的手机控制、Telegram 定制及个人任务插件不在本次范围内。旧 `cosmo-ui/` 已由当前 Cosmo 界面替代，未导入其历史产物。
