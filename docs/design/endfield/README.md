# hhikr.moe 改版（终末地气质）：现状说明

分支 `redesign/endfield`。这是进行中的原型，尚未合并、尚未部署。

本目录三份文件：

- `README.md`（本文件）：改到哪了、哪些决定已经定下、还差什么。**与下面两份有出入时，以本文件为准。**
- `design-plan.md`：设计方案。最初写于动手之前，2026 年 10 月 13 日已按原型改写为现在的决定，改动见其文末的"修订记录"。
- `findings.md`：对游戏官网和界面的调研。文中按文件名引用的截图（`cn-*.png`、`intl-*.png`、`game-*.png`、`fzwiki-*.png`）就在本目录。
- `contour-reference/`：站长给的三张等高线参考图。背景等高线要的就是这种不闭合、成束流动的线。
- `skill/endfield-ui/`：把这套设计提炼成的通用 agent skill，与本站无关、可以单独拿走：调研结论、平台无关的 token（`assets/tokens.json`）、网页 CSS 套件和模板、已验证的 Flutter 套件、iOS / Android / 小程序 / React Native 等平台指南、App 界面范式、反例对照页和示例截图。安装：把整个 `endfield-ui` 目录复制到 `~/.claude/skills/`（或某个项目的 `.claude/skills/`），入口是其中的 `SKILL.md`。
- `shots/`：各轮原型的预览截图，文件名里数字越大越新。被认可的最终版是 `home7-light.jpg`、`endmin6-light.jpg`、`endmin6-dark.jpg`、`post-light/dark/mobile.jpg`、`works-light.png`、`works-dark.png`、`works-mobile.jpg`；编号更小的 `home*`、`endmin*` 是已被否决的版本，可用来对照"不要什么"。这些最终版截图都早于背景等高线的改动，背景以代码为准。

本目录里的 `*.png` 和 `contour-reference/` 是游戏及其官网的截图，**只作设计参考，不得用进网站**。

## 页面状态

旧变量别名（`--sky`、`--card`、`--paper-2` 等）已从 `global.css` 删除，所有页面都用新变量。

**原型阶段做完、由站长认可的**（不要重新设计）：

| 页面 | 文件 | 认可的截图 |
| --- | --- | --- |
| 全局变量、外壳、导航、页脚 | `src/styles/global.css`、`src/layouts/Base.astro`、`src/components/Header.astro`、`Footer.astro` | — |
| 首页 | `src/pages/index.astro` | `home7-light.jpg` |
| 文章页 | `src/components/PostArticle.astro`、`Toc.astro`、`SeriesNav.astro`、`src/styles/prose.css` | `post-light/dark/mobile.jpg` |
| 作品列表 | `src/pages/works/index.astro` | `works-light.png`、`works-dark.png`、`works-mobile.jpg` |
| 管理页外壳和总览 | `src/layouts/Endmin.astro`、`src/pages/endmin/index.astro` | `endmin6-light.jpg`、`endmin6-dark.jpg` |

**铺开阶段改的**（尚待站长审阅；截图在 `shots/`，文件名为 页面名-light/dark/mobile.jpg）：

| 页面 | 文件 | 截图 |
| --- | --- | --- |
| 文章列表 | `src/pages/posts/index.astro`、`src/components/PostRecord.astro`、`Heatmap.astro` | `posts-*` |
| 分类 | `src/pages/categories/index.astro` | `categories-*` |
| 单个分类、单个标签 | `src/pages/categories/[cat].astro`、`src/pages/tags/[tag].astro`、`src/layouts/TermList.astro` | `category-*`、`tag-*` |
| 合订本、单本 | `src/pages/series/index.astro`、`[name].astro` | `series-*`、`series-volume-*` |
| 标签 | `src/pages/tags/index.astro` | `tags-*` |
| 关于 | `src/pages/about.astro` | `about-*` |
| 作品详情 | `src/pages/works/[slug].astro` | `work-*` |
| 登录 | `src/pages/login.astro` | `login-*`（带错误提示的状态） |
| 隐私 | `src/pages/privacy.astro` | `privacy-*` |
| 404 | `src/pages/404.astro` | `404-*` |
| 评论区、搜索框 | `src/components/Comments.astro`、`Search.astro`、`src/scripts/comments.ts` | 无单独截图 |
| Hot 100 外框 | `public/hot100-assets/style.css` 末尾一段 | `hot100-*` |
| 管理：文章、编辑器、预览 | `src/pages/endmin/posts.astro`、`posts/[id]/index.astro`、`src/scripts/editor.ts`；预览直接用文章页 | `endmin-posts-*`、`endmin-editor-*` |
| 管理：评论、媒体、统计、用户、备份 | `src/pages/endmin/*.astro` | `endmin-comments-*` 等 |
| 管理：作品列表、作品编辑 | `src/pages/endmin/works/index.astro`、`[id].astro` | `endmin-works-*`、`endmin-work-edit-*` |

**共用的写法**（新页面先找这里）：

- 阅读类页面：`global.css` 的 `.spread` / `.sheet` / `.margin` 版式，`.crumb`（上一级）、`.sheet-head`（页名加计数）、`.lede`、`.empty`（空状态）、`.filters`、`.group-head`（列表里的分组标题）、`.records`（记录行）、`.more`、`.margin-h` 加 `.ledger`（页边的数字表）。
- 按钮：`global.css` 的 `.btn`（切角、黄色擦入，原样从首页移出），`.btn.go`、`.btn.small`、`.btn.danger`（只用于删除）；一排按钮用 `.actions`。
- 表单：给容器加 `.form`，标签用 `.field`；出错提示用 `.notice`（黄色"注意"小旗）。
- 管理页：`Endmin.astro` 的 `.em-panel`（白底、顶边粗墨色页签，和总览看板同一种）、`.em-rows`（悬停有色条）、`.em-tiles`、`.em-state`（`published` 实线、`hidden`/`draft` 虚线、`alert`/`banned` 黄块）、`.em-btn`、`.em-filters` 里的 `.end`（放在最右的主操作）、`.em-note`、`.em-empty`，以及配合筛选的 `data-filter-empty`。`wide` 属性给编辑器用整个窗口宽度。

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

## 铺开阶段的设计判断（站长可改）

- **列表页一律是"白纸加页边"**：页边放真实的统计（各类篇数、字数合计、最近一篇、写作日历等）。另一种做法是像旧版那样整页一栏、没有页边。
- **文章列表按年份分组**，组头是等宽的年份和篇数；写作日历（热力图）移到页边。旧版是左侧大号斜体年份。
- **分类页**每类显示最近 5 篇加"全部 N 篇"；页边用斜线纹底的墨色条显示各类占比。另一种做法是只列分类名和说明，不列文章。
- **合订本列表**保留"每章一格"的进度条，悬停时浅色主题亮黄、深色主题亮 `--trace`。单本页的章节行第一列是章序 `01`，不是文章编号。
- **标签页**改为按篇数排序的一排切角小标签，不再用字号大小表示多少（旧版的标签云）。
- **关于页**：头像放在页边，版本沿革最新一条的版本号是黄色"当前"标签；"本站使用"更新为现在的字体（去掉了已不用的 Instrument Serif）。
- **作品详情**沿用文章页的版式，下载按钮在标题下；页边是"本页"目录和链接。旧版是左文右图的大头图。
- **404** 用首页的语气：空心大数字、黄色马克笔一句、切角按钮。它也可以走安静的阅读调子。
- **评论区和搜索框**：头像改成方形，首字母头像用 `--tag-bg`（原来按名字取随机色相）；弹窗是墨色描边加顶边粗页签。
- **Hot 100**：题目列表里当前题是整行黄块；难度由绿/黄/红改为 灰底 / 墨色描边 / 墨底；侧栏标题 Hot 实心、100 空心。实验区、代码编辑器、Java 面板没动，它们用到的颜色变量固定为原来的值。
- **管理子页**：内容都放在和总览同款的看板上（白底、顶边粗页签）；没有改成卡片网格。编辑器从网站自己的外壳移进管理页的命令栏下面，占满窗口宽度。
- **红色只留给删除**：因此"撤回为草稿""封禁用户""从列表移除（链接、图片、封面）"都改成了普通按钮（仍保留确认框）；备份失败、待审评论、已封禁用户改为黄色标记；出错提示是黄色"出错/注意"小旗；版本对比里新增的内容用黄色标记、删除的内容用灰色删除线，不再用绿色和红色。如果站长认为封禁也算"危险操作"，在 `src/pages/endmin/users.astro` 给那个按钮加回 `danger` 即可。
- **统计图**在手机上保持可读的最小宽度、在看板里横向滚动，而不是整体缩小。

## 还没做的事

- 文章编号（No.001…）目前由 `src/lib/posts.ts` 的 `postNumbers()` 按发布顺序现算，没有存进数据库。存库要改数据库结构，不在纯界面改版范围内。
- 管理页里的 Hermes 面板和定时任务日历依赖服务器上的另一个服务，本机无法预览，只核对过代码。用 Google 登录的流程本机也无法走通。
- 动效只核对过样式数值，没有逐个目视确认手感。两个持续动画与"不做持续循环的装饰动画"的原则不符，待站长决定：首页的近期文章滚动条（承载内容，悬停即停）、管理总览外圈缓慢旋转的虚线环。
- 首页、文章页等原型页的截图早于背景等高线的改动，需要时重截。
