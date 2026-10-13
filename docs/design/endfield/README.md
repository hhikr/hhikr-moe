# hhikr.moe 改版（终末地气质）：现状说明

分支 `redesign/endfield`。这是进行中的原型，尚未合并、尚未部署。

本目录三份文件：

- `README.md`（本文件）：改到哪了、哪些决定已经定下、还差什么。**与下面两份有出入时，以本文件为准。**
- `design-plan.md`：设计方案。最初写于动手之前，2026 年 10 月 13 日已按原型改写为现在的决定，改动见其文末的"修订记录"。
- `findings.md`：对游戏官网和界面的调研。文中按文件名引用的截图（`cn-*.png`、`intl-*.png`、`game-*.png`、`fzwiki-*.png`）就在本目录。
- `contour-reference/`：站长给的三张等高线参考图。背景等高线要的就是这种不闭合、成束流动的线。
- `shots/`：各轮原型的预览截图，文件名里数字越大越新。被认可的最终版是 `home7-light.jpg`、`endmin6-light.jpg`、`endmin6-dark.jpg`、`post-light/dark/mobile.jpg`、`works-light.png`、`works-dark.png`、`works-mobile.jpg`；编号更小的 `home*`、`endmin*` 是已被否决的版本，可用来对照"不要什么"。这些最终版截图都早于背景等高线的改动，背景以代码为准。

本目录里的 `*.png` 和 `contour-reference/` 是游戏及其官网的截图，**只作设计参考，不得用进网站**。

## 已经改过的页面

| 页面 | 文件 | 状态 |
| --- | --- | --- |
| 全局变量、外壳、导航、页脚 | `src/styles/global.css`、`src/layouts/Base.astro`、`src/components/Header.astro`、`Footer.astro` | 已改 |
| 首页 | `src/pages/index.astro` | 已改（最终截图 `shots/home7-light.jpg`） |
| 文章页 | `src/components/PostArticle.astro`、`Toc.astro`、`SeriesNav.astro`、`src/styles/prose.css` | 已改 |
| 作品页 | `src/pages/works/index.astro` | 已改 |
| 管理页外壳和总览 | `src/layouts/Endmin.astro`、`src/pages/endmin/index.astro` | 已改 |
| 其余页面（分类、合订本、题单、关于、登录、管理子页等） | — | **未改**，靠 `global.css` 里的旧变量别名维持可用 |

## 已定下的设计决定

这些是站长逐轮看过后定下的，不要改回去。

**配色**

- 浅色为主：纸面 `--paper #f4f4f2`，面板 `--panel #fff`，墨色 `--ink #161616`。
- 黄色 `--signal #fffa00` 只表示"当前所在"和"可操作"，不做大面积底色。
- **否决**：黑底配黄色大字（尤其是浅色模式下）。
- **否决**：管理页总览里用红色。告警用 `--trace` 和黄色标记；红色 `--danger` 只留给删除一类的危险操作。

**字体**

- 界面文字 `--font-ui`：JetBrains Mono 配思源黑体（Noto Sans SC），都由本站自托管。
- 正文阅读 `--font-text`：霞鹜文楷，只用于读的内容。
- **否决**：用系统黑体作后备来凑合，必须自托管。

**版式**

- 首页：大字标 `HHIKR` 实心加 `.MOE` 空心；右侧是站长的线稿头像（`src/assets/avatar.png`），缩放 0.92、贴底、两侧渐隐；下面是滚动的近期文章条和可交互的索引区。
- 管理页：**没有左侧列表**。顶部一条深色命令栏，中间是八段的圆盘（每段是一个入口，可点击），左右各三块看板。
- 看板要求：左右对称（各三块、同行等高），但不能排成规整的表格。现在的做法是上下两块向圆心靠拢并切掉朝圆的一角，中间一块退开并用引线连到圆盘。
- **否决**：规整的卡片网格式仪表盘；细线加楷体的径向布局。

**背景**

- 纸面留白，只在右上角和左下角各有一小片等高线，墨色 9%，向边缘渐隐。
- 等高线必须是**不闭合、像水流一样**的长线，不要一圈圈的山丘。由 `scripts/draw-contours.mjs` 生成到 `public/contour-a.svg`、`contour-b.svg`。
- **否决**：点阵或网格图纸式的背景。

**动效**

- 机械、利落：切角按钮的黄色擦入、数字乱码后落定（`src/scripts/fx.ts`）、导航黄块随页面切换滑动、页面切换的"快门"。
- 全部在 `prefers-reduced-motion` 下关闭。

## 技术约束

- 生产环境有内容安全策略：脚本只能来自本站，字体只能来自本站或 `data:`。开发服务器不发这条策略，要验证须 `npm run build` 后用 `npm run preview`。
- 不使用任何游戏官方素材（字体、标志、图标、插画、截图、文案）。

## 本地预览

`.data/` 不进仓库。在空目录里建一个测试库（Node 24）：

1. `node scripts/import-posts.mjs`：建库并导入 `src/content/posts/` 的文章和配图。
2. 设环境变量 `ENDMIN_GOOGLE_EMAIL=owner@example.com`，用 `src/server/auth.ts` 的 `signInWithGoogle` 建一个管理员（写法同 `tests/server/auth.test.mjs`），再用 `node scripts/endmin-login-link.mjs` 取一次性登录链接。
3. `node scripts/seed-sample-data.mjs --local`：加入假的用户、评论、作品和访问记录，用来看这些页面有内容时的样子。所有名字和文字都写明是示例数据。只对开发用的库运行。

## 还没做的事

- 其余页面的改版（见上表）。
- `src/pages/works/index.astro` 里有仅开发环境生效的 `?sample` 假数据，定稿前删掉。
- 文章编号（No.001…）目前由 `src/lib/posts.ts` 的 `postNumbers()` 按发布顺序现算，没有存进数据库。
- 思源黑体的许可证文本（OFL 1.1）还没有复制进仓库。
- 管理页里的 Hermes 面板和定时任务日历在本机无法预览，没有实际看过效果。
- 动效只核对过样式数值，没有逐个目视确认手感。
