# Cosmo 网页版

Cosmo 是 Hermes 助手的网页界面，只有网站的 endministrator 能打开。界面不是自己写的：它直接使用 [Hermes Desktop](https://hermes-agent.nousresearch.com/docs/user-guide/desktop) 的渲染层源码（`hermes-agent` 仓库的 `apps/desktop/src`，MIT 许可），一行不改，换掉的只有它和 Electron 之间的那层桥接。

## 组成

| 部分 | 位置 | 作用 |
| --- | --- | --- |
| 桥接 | [shim/bridge.js](shim/bridge.js) | 在浏览器里提供 `window.hermesDesktop`，代替 Electron 的 preload |
| 网关 | [gate/server.mjs](gate/server.mjs)、[gate/auth.mjs](gate/auth.mjs) | 检查登录，发送页面文件，把 `/api/*`（含 WebSocket）转给 Hermes |
| 构建 | [build.mjs](build.mjs) | 用上游自己的 Vite 配置构建渲染层，再把桥接放进页面 |
| 主站一侧 | `src/server/cosmo.ts`、`src/pages/api/auth/cosmo.ts`、`src/pages/api/internal/cosmo.ts` | 把 endministrator 的登录状态交给 Cosmo |

渲染层只通过 `window.hermesDesktop` 接触本机，其余全部走 Hermes 后端的接口。桥接把连接描述成“远程后端”，渲染层于是用后端自己的接口读写文件、查看 Git、选择工作目录，这些功能不需要额外实现。

网关和 Hermes 后端都只监听回环地址。Hermes 的会话令牌由网关在服务端读取并附加到请求上，页面里的令牌是占位符，浏览器拿不到真的。

## 登录

主站的登录 Cookie 以 `__Host-` 开头，子域名收不到，所以分两步交接：

1. 未登录的浏览器打开 Cosmo，网关生成一个 `state`，把浏览器送到主站的 `/api/auth/cosmo`。
2. 主站确认当前会话属于 endministrator，生成一个一分钟内有效、只能用一次的授权码，带着它回到 Cosmo 的 `/auth/callback`。没登录的先去登录页，登录后回到这一步；其他账号得到 404。
3. 网关核对 `state`，在本机向主站的 `/api/internal/cosmo` 兑换授权码，得到一个“许可”，然后给浏览器设置自己的 Cookie。
4. 之后网关每 30 秒向主站确认一次许可是否仍然有效。在主站退出登录、会话过期、账号被封禁或角色变化，许可随之失效，网关结束会话并断开它名下的 WebSocket。

`/api/internal/cosmo` 用共享密钥验证调用方，Caddy 另外对公网隐藏了 `/api/internal/*`。数据库只保存授权码和许可的哈希。

## 和桌面版的差别

| 桌面版功能 | 网页版 |
| --- | --- |
| 聊天、流式回复、工具记录、会话管理、模型与推理强度、命令面板 | 相同 |
| 技能、工具集、连接器、插件、消息平台、定时任务、产物、记忆、设置 | 相同（都是后端接口） |
| 文件浏览、文件编辑、Git 状态与审查、工作目录选择 | 相同，但对象是 Hermes 所在的机器，不是你面前这台电脑 |
| 附件：选择文件、拖入、粘贴图片、粘贴长文本 | 文件留在浏览器内存里，发送时上传 |
| 多窗口 | 变成浏览器标签页 |
| 系统通知、剪贴板、麦克风 | 使用浏览器的对应功能，需要授权 |
| 页面内查找 | 用浏览器自己的 Ctrl/Cmd+F |
| 终端面板 | 没有。桌面版的终端是本机的 shell，网页没有对应物 |
| 内置浏览器预览、技能中心的嵌入页 | 多数网站禁止被嵌入，显示为空白；文件和产物预览正常 |
| HUD 悬浮条、Quick Entry 全局热键、托盘、窗口置顶、读取其他窗口、防休眠、桌宠浮窗 | 没有，依赖操作系统 |
| 添加/切换网关、SSH 与云端连接、本地模型、自动更新、卸载 | 没有。网页版只连接提供它的那一个后端 |
| 导入 VS Code 主题 | 没有 |

桌面版的功能大多用 `window.hermesDesktop?.x` 的方式探测，所以桥接里不提供的成员对应的入口会自动隐藏或失效。桥接在控制台用 `debug` 级别记录每一个被读取但没有提供的成员，用来发现上游新增的接口。

## 构建

渲染层的版本必须和后端一致。先确认后端运行的提交（在服务器上对 Hermes 的源码目录执行 `git rev-parse HEAD`），再准备同一提交的源码：

```powershell
git clone --depth 1 https://github.com/NousResearch/hermes-agent.git .deployment/hermes/upstream
git -C .deployment/hermes/upstream fetch --depth 1 origin <提交>
git -C .deployment/hermes/upstream checkout FETCH_HEAD
npm --prefix .deployment/hermes/upstream ci --workspace apps/desktop --include-workspace-root --ignore-scripts
npm run cosmo:build
```

`--ignore-scripts` 跳过 Electron 和原生模块的安装，网页构建用不到它们。产物在 `.deployment/hermes/cosmo-web/dist`，约 41 MB，其中 `cosmo/build.json` 记录了所用的 Hermes 提交。

Hermes 后端升级后，按新的提交重复上面的步骤并重新发布。升级后先看一遍控制台里“bridge member not provided”的记录，再决定是否要给桥接补成员。

## 本机调试

启动 Hermes 的本机连接（它把服务器的 9119 端口转到本机），然后：

```powershell
node tools/cosmo/gate/dev.mjs
```

打开 `http://127.0.0.1:19140/`。这个模式不需要登录，网关只在监听地址和公开地址都是回环地址时才允许这样运行。

## 测试

```powershell
npm run test:cosmo    # 网关：登录流程、转发、来源检查、WebSocket、会话失效
npm run test:server   # 其中 tests/server/cosmo.test.mjs 覆盖主站的授权码和许可
```

## 网关的配置

环境变量，括号内为默认值。

| 变量 | 含义 |
| --- | --- |
| `COSMO_LISTEN` | 监听地址，必须是回环地址（`127.0.0.1:4410`） |
| `COSMO_PUBLIC_ORIGIN` | 浏览器使用的地址。请求的 Host 和 WebSocket 的 Origin 都必须与它一致 |
| `COSMO_STATIC_DIR` | 构建产物目录 |
| `COSMO_HERMES` | Hermes 后端，必须是回环地址（`http://127.0.0.1:9119`） |
| `COSMO_AUTH` | `site`（默认）或 `none` |
| `COSMO_SITE_PUBLIC`、`COSMO_SITE_INTERNAL` | 主站的公开地址，以及从本机访问它的地址 |
| `COSMO_GATE_SECRET` | 与主站共享的密钥，至少 32 个字符。主站一侧用同名变量，另有 `COSMO_ORIGIN` 指定 Cosmo 的地址 |

## 需要知道的风险

网页版开放的是完整的管理界面：模型密钥、配置、技能、定时任务，以及通过助手在服务器上执行命令。能拿到 endministrator 会话的人就能做这些事，所以主站账号的安全等同于这台服务器上 Hermes 的安全。

页面的内容安全策略允许内联脚本。渲染层用沙箱化的 `srcdoc` 框架显示助手生成的 HTML，这类框架继承页面的策略，禁止内联脚本会让产物预览失效。保留下来的限制是：脚本文件只能来自本站，页面不能被其他网站嵌入。
