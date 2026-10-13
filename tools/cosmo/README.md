# Cosmo 网页版

Cosmo 是 Hermes 助手的网页界面，只有网站的 endministrator 能打开。界面不是自己写的：它直接使用 [Hermes Desktop](https://hermes-agent.nousresearch.com/docs/user-guide/desktop) 的渲染层源码（`hermes-agent` 仓库的 `apps/desktop/src`，MIT 许可），一行不改，换掉的只有它和 Electron 之间的那层桥接。

## 组成

| 部分 | 位置 | 作用 |
| --- | --- | --- |
| 桥接 | [shim/bridge.js](shim/bridge.js) | 在浏览器里提供 `window.hermesDesktop`，代替 Electron 的 preload |
| 网关 | [gate/server.mjs](gate/server.mjs)、[gate/auth.mjs](gate/auth.mjs) | 检查登录，发送页面文件，把 `/api/*`（含 WebSocket）转给 Hermes |
| 覆盖样式 | [shim/cosmo.css](shim/cosmo.css) | 排在渲染层的样式之后，修正它在浏览器和手机上的显示 |
| 触屏 | [shim/touch.js](shim/touch.js) | 手机上点侧边栏外面或选中一项后，把侧边栏收起来 |
| 补丁 | [patches.mjs](patches.mjs) | 构建时对渲染层个别源文件做的替换，见“和桌面版的差别” |
| 构建 | [build.mjs](build.mjs) | 用上游自己的 Vite 配置加上补丁构建渲染层，再把 `shim/` 的三个文件放进页面 |
| 主站一侧 | `src/server/cosmo.ts`、`src/pages/api/auth/cosmo.ts`、`src/pages/api/internal/cosmo.ts` | 把 endministrator 的登录状态交给 Cosmo |

渲染层只通过 `window.hermesDesktop` 接触本机，其余全部走 Hermes 后端的接口。桥接把连接描述成“远程后端”，渲染层于是用后端自己的接口读写文件、查看 Git、选择工作目录，这些功能不需要额外实现。

网关和 Hermes 后端都只监听回环地址。Hermes 的会话令牌由网关在服务端读取并附加到请求上，页面里的令牌是占位符，浏览器拿不到真的。

## 登录

主站的登录 Cookie 以 `__Host-` 开头，子域名收不到，所以登录状态要从主站交接过来：

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
| 预览随文件变化自动刷新 | 没有，需要手动刷新 |
| HUD 悬浮条、Quick Entry 全局热键、托盘、窗口置顶、读取其他窗口、防休眠、桌宠浮窗 | 没有，依赖操作系统 |
| 添加/切换网关、SSH 与云端连接、本地模型、自动更新、卸载 | 没有。网页版只连接提供它的那一个后端 |
| 导入 VS Code 主题 | 没有 |

桌面版的功能大多用 `window.hermesDesktop?.x` 的方式探测，所以桥接里不提供的成员对应的入口会自动隐藏或失效。桥接在控制台用 `debug` 级别记录每一个被读取但没有提供的成员，用来发现上游新增的接口。

### 状态栏

底部状态栏能显示终端界面状态行里的那些读数：上下文用量和进度条（点开有分类明细）、缓存命中率、每秒 token 数、本轮计时、会话计时。渲染层默认把它们全部隐藏，桥接在每个浏览器第一次打开时把它们设为显示（`cosmo.statusbarSeeded.v1` 记录已经设过）。之后在状态栏上点右键（手机上长按）可以逐项开关，选择会保留。

终端状态行里还有两项渲染层没有，由补丁加上：平均延迟（时钟图标，后端随用量一起发来的 `avg_latency_s`）和空闲计时（`✓`，上一次回复结束到现在的时间，由页面自己计时，所以刷新或换会话后要等下一轮结束才出现）。

手机上状态栏变成两行，离开屏幕底边：上面一行是会话读数，依次为上下文用量、缓存命中率、平均延迟、空闲计时，放不下的（每秒 token 数、会话计时、审批模式）向左滑动可见；下面一行是后端状态和工作目录。上下文进度条在手机上从 10 格缩为 5 格。

### 补丁

渲染层的源码目录不改，但有几处行为和桌面版不同，由 [patches.mjs](patches.mjs) 在构建读取源文件时替换。除了上面状态栏的两项和手机上的进度条长度，还有：

| 位置 | 桌面版 | 网页版 |
| --- | --- | --- |
| 对话里的“已保存到记忆”一行 | 写入成功时点不开：上游只显示结果里的 `message`，而成功的写入没有这个字段 | 可以点开，列出这次写入的内容：`+` 新增，`~` 替换（括号里是用来定位旧条目的文字），`−` 删除；开头标明写入的是“笔记”还是“用户档案” |
| “已保存到记忆”后面的数字 | `3 entries`，容易读成这次写了 3 条 | `共 3 条`：它是写入之后那个记忆库的条目总数 |

另有一处：MCP 服务器连不上时不再弹出警告。这个站点唯一的自定义服务器是站长自己的电脑，经隧道接入，电脑不开机是常态。连接器页面仍然会把它标为出错；登录过期（需要重新认证）的提示保留。

每个补丁写明目标文件和要替换的原文。原文找不到时构建直接失败，所以 Hermes 升级后如果上游改了这段代码，会在构建时发现。补丁需要完整构建才生效，`--skip-build` 不会应用它。

## 手机

渲染层是为桌面窗口写的，窄到 768px 以下时它自己会把侧边栏变成滑出层，其余不变。[shim/cosmo.css](shim/cosmo.css) 和 [shim/touch.js](shim/touch.js) 补上手机需要的部分，不改渲染层的源码：

- 页面高度跟随浏览器地址栏的显隐（`100dvh`），键盘弹出时页面缩小而不是被盖住。
- 标签页的关闭按钮有自己的位置，不压在标题上；当前标签的关闭按钮常显，因为触屏没有悬停。
- 640px 以下：隐藏布局编辑器、HUD、左右互换这三个只对桌面窗口有意义的按钮，隐藏折叠成 28px 窄条的区域（终端），标题栏按钮的可点范围放大，侧边栏的行加高，输入框字号不低于 16px（否则 iOS 会在聚焦时放大页面）。
- 侧边栏打开时其余部分变暗；点暗处或选中一个会话、一个页面，侧边栏收起。
- 输入框只在被点到时才获得焦点。渲染层以键盘为先，点到空白处、关闭菜单、打开会话之后都会把焦点交还输入框，在手机上这等于每点一下就弹出输入法。这一条由补丁实现，按 `(hover: none)` 判断，带触屏的笔记本不受影响。

这些规则尽量按渲染层的 `data-*` 属性选择元素。Hermes 升级后属性可能改名，规则会悄悄失效而不是报错，所以升级后要在手机宽度下看一遍：标题栏只剩设置和右侧栏两个按钮、右边没有窄条、侧边栏点外面能收起。

## 管理页

Hermes 自带的管理页（`hermes dashboard`，后端在回环端口上提供的那一套）挂在 `/admin/` 下，和 Cosmo 用同一个登录。它不经过构建：网关把 `/admin/` 下的请求去掉前缀后转给后端，并带上 `X-Forwarded-Prefix: /admin`，后端据此把页面里的资源和接口地址都写成带前缀的。

网关在中间做三件事：

- 后端在页面里写入了会话令牌，网关在转出前把它换成占位值。浏览器之后带着占位值来请求，网关再换回真的，和 Cosmo 的做法一样。压缩过的页面无法检查，直接拒绝。
- 这个浏览器没有选过语言时，把管理页的语言设为简体中文（管理页默认英文，语言存在 `localStorage` 的 `hermes-locale`）。
- 管理页按需加载的页面会到根路径的 `/assets/` 找样式文件，不管自己被挂在哪个前缀下。网关在自己的 `assets/` 里找不到某个文件时，改向后端要。构建产物以内容命名，两边不会重名。

主题和字体是管理页自带的功能，在侧边栏左下角切换，选择保存在 Hermes 的配置里。自定义主题是 Hermes 数据目录下 `dashboard-themes/*.yaml`。

## 构建

上游源码和构建产物都放在 `.deployment/` 下，这个目录不进仓库。

渲染层的版本必须和后端一致。先确认后端运行的提交（在服务器上对 Hermes 的源码目录执行 `git rev-parse HEAD`），再准备同一提交的源码：

```powershell
git clone --depth 1 https://github.com/NousResearch/hermes-agent.git .deployment/hermes/upstream
git -C .deployment/hermes/upstream fetch --depth 1 origin <提交>
git -C .deployment/hermes/upstream checkout FETCH_HEAD
npm --prefix .deployment/hermes/upstream ci --workspace apps/desktop --include-workspace-root --ignore-scripts
npm run cosmo:build
```

`--ignore-scripts` 跳过 Electron 和原生模块的安装，网页构建用不到它们。产物在 `.deployment/hermes/cosmo-web/dist`，约 41 MB，其中 `cosmo/build.json` 记录了所用的 Hermes 提交。

只改了 `shim/` 下的文件时，`npm run cosmo:build -- --skip-build` 把它们放进已有的产物，不重新构建渲染层。

Hermes 后端升级后，按新的提交重复上面的步骤并重新发布。升级后先看一遍控制台里“bridge member not provided”的记录，再决定是否要给桥接补成员。

## 发布

产物和 `gate/` 目录一起打包，上传到服务器，由常驻的网关服务提供，前面是 Caddy。服务器上的脚本、服务单元、检查和回滚步骤在 `tools/deploy/`（第 8b 节）；那个目录写有服务器的地址，不进仓库。

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
| `COSMO_GATE_SECRET` | 与主站共享的密钥，至少 32 个字符 |
| `COSMO_RECHECK_MS` | 向主站重新确认许可的间隔，毫秒（`30000`）。测试用 |

主站一侧有两个变量：`COSMO_ORIGIN` 是 Cosmo 的地址，授权码只会送到这里；`COSMO_GATE_SECRET` 与网关的相同。没有前者，`/api/auth/cosmo` 返回 404；没有后者，授权码无处兑换。

## 需要知道的风险

网页版开放的是完整的管理界面：模型密钥、配置、技能、定时任务，以及通过助手在服务器上执行命令。能拿到 endministrator 会话的人就能做这些事，所以主站账号的安全等同于这台服务器上 Hermes 的安全。

页面的内容安全策略允许内联脚本。渲染层用沙箱化的 `srcdoc` 框架显示助手生成的 HTML，这类框架继承页面的策略，禁止内联脚本会让产物预览失效。保留下来的限制是：脚本文件只能来自本站，页面不能被其他网站嵌入。

策略还放行了 Google Fonts（上游界面的一种字体从那里加载），以及页面到任意 HTTPS 地址的请求（语音服务和插件目录由页面直接访问）。主站不依赖 Google Fonts，Cosmo 是例外。
