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

服务器上运行的 Hermes 在 `/opt/hermes-hhikr/source/`，**不是 git 仓库**，是从本仓库复制过去的。修改这里的源码后，要同步到服务器才会生效；同步和重启的步骤在 `tools/deploy/README.md` 的 8b 节（那个目录不进仓库）。不要在服务器上直接改源码，下次同步会被覆盖或对不上。

## Windows 连接器

```powershell
npm --prefix tools/hermes/windows-bridge ci
node tools/hermes/windows-bridge/setup.mjs
node tools/hermes/windows-bridge/bridge.mjs
```

安装脚本生成本机凭据和配置，不覆盖已有凭据。默认授权根目录是网站项目。`verify.mjs` 检查已运行连接器的认证、文件边界与命令执行；`verify-development.mjs` 需要另行配置原有 VPS 路径映射，只用于该开发环境。

**实际在运行的连接器不在上面的目录里**，而是在 `.deployment/hermes/windows-bridge/`（那里有 `node_modules`、`connection-private.json` 和 `bridge.log`）。`tools/hermes/windows-bridge/` 只有源码，直接在那里运行 `bridge.mjs` 会因为缺依赖和配置而失败。启动方式：

```powershell
Set-Location .deployment\hermes\windows-bridge
Start-Process -FilePath node -ArgumentList 'bridge.mjs' -WorkingDirectory $PWD -WindowStyle Hidden -PassThru -RedirectStandardOutput "$PWD\bridge.log" -RedirectStandardError "$PWD\bridge-error.log"
```

**审批已默认关闭**（`bridge.mjs` 的 `needsApproval` 恒返回 `false`，用户选择“全部默认允许”）。PowerShell 命令、浏览器操作和签名目录写入都直接执行，不再弹本机审批页面。仍然生效的硬限制：项目目录边界、`.deployment`/`.ssh` 等敏感目录、`.git` 内部写入、`setup.mjs` 中的命令黑名单、浏览器不能访问本机管理页面。要恢复审批，把 `needsApproval` 改回原来的判断并重启连接器。

连接器没有开机自启动。它停了以后，Hermes 本身照常运行，只是 `mcp_windows_*` 工具（读写文件、运行命令、浏览器）缺失，会话会报告“没有挂载”。

**排查“会话里没有 `mcp_windows_*` 工具”**：

1. 电脑上 `19120` 是否在监听：`Get-NetTCPConnection -LocalPort 19120`。没有就是连接器没运行，按上面的方法启动。
2. 服务器上经隧道探测：带 `HERMES_WINDOWS_TOKEN` 的 `initialize` 返回 200，不带令牌返回 401。返回 000 说明隧道另一端没有连接器。
3. Hermes 的 MCP 发现在每次新会话启动时重试，所以连接器恢复后新开会话就会挂上。服务器的 `state/logs` 里有 `Background MCP discovery completed with zero connected servers` 说明那一次没连上。不需要重启 Hermes，除非旧会话仍然缺工具（那种情况下重启 `hermes-hhikr` 会打断会话）。

## 导入边界与许可证

保留 `source/LICENSE`、原版权声明和各组件许可证。Hermes 根许可证为 MIT，允许修改和分发；依赖和素材按各自许可证处理。

没有导入 `.git`、依赖、构建产物、连接凭据、审批状态、日志、数据库、迁移备份或签名材料。`Downloads/hermes-dev/` 的手机控制、Telegram 定制及个人任务插件不在本次范围内。旧 `cosmo-ui/` 已由当前 Cosmo 界面替代，未导入其历史产物。
