# 网站功能与内容维护

v2 起使用 [Astro](https://astro.build) 构建，以 Node 服务的形式运行：`npm run build` 生成 `dist/client/`（预渲染页面和静态文件）与 `dist/server/`（服务入口）。

## 开发

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # 类型检查 + 构建 + 生成搜索索引
npm run preview      # 预览构建结果（搜索只在构建后可用）
npm run test:server  # 服务端逻辑的测试（账号、评论、文章、备份、Markdown 渲染等）
npm run test:cosmo   # Cosmo 网关的测试（登录交接、转发、来源检查）
npm run import:posts # 把 src/content/posts 导入本机数据库（.data/），供开发使用
```

网站已部署到 ByteVirt VPS，通过 NameSilo 管理 `hhikr.moe` 解析，使用 Caddy 提供 HTTPS。构建、上传、服务器配置、证书、验收和回滚的流程，以及服务器上的配置文件和脚本，放在 `tools/deploy/`。这个目录写有服务器的地址和端口，所以不进入仓库，只保存在站长的电脑上。同一台服务器上的 Cosmo（`cosmo.hhikr.moe`）单独构建和发布，见 [tools/cosmo/README.md](../tools/cosmo/README.md)。

## Hot 100 学习区

导航中的“算法”进入 `/hot100/`。100 道题按 17 个分类组织，每题提供 Java 解法、输入输出说明、自定义输入动画和编程练习。动画支持 `A` 后退、`D` 前进；主题切换支持匀速扩散和中途反向。

编译运行和类型提示通过本机 Java 服务提供。练习页可下载服务包，连接说明见 [本机 Java 服务](../tools/hot100-java/README.md)，方法式练习与标准输入说明见 [Java 练习输入输出](../tools/hot100-java/practice-guide.md)。Java 程序只在用户自己的电脑上执行，服务器不提供代码执行接口。

```bash
npm run test:hot100   # 课程、算法、动画与结果比对验证
npm run java:package # 从 tools/hot100-java 生成下载包
npm run java:serve   # 启动允许 https://hhikr.moe 连接的本机服务
```

服务需要 Node.js 和包含 `javac` 的 JDK。项目内调试其他网站来源时，执行 `node tools/hot100-java/server.mjs --site http://localhost:4321`，并在网页填写相同端口。

## 写文章

文章保存在服务器的数据库里，不在这个仓库中。用站长的 Google 账号在 `/login/` 登录后进入管理面板 `/endmin/`，在「文章」里写新文章或编辑已有的文章：左边写 Markdown，右边实时预览，粘贴或拖入图片会自动上传。修改会自动保存，点「发布」或「更新」之后读者才能看到。

`src/content/posts/` 下的 Markdown 是迁移到数据库之前的原件，修改它们不会影响网站。

Markdown 扩展语法（与 Obsidian 兼容）：

| 写法 | 效果 |
| --- | --- |
| `$E=mc^2$`、`$$ … $$` | KaTeX 公式 |
| `> [!note]` / `> [!tip] 标题` / `> [!warning]-` | 提示框（`-` 折叠，`+` 可折叠但展开） |
| `\|\|剧透\|\|` | 点击显示的遮罩文字 |
| `![说明](pic.png "图注")` | 带图注的插图，可点击放大 |

## 配置

- `src/site.config.ts`：站点信息、导航、分类、社交链接
- `src/data/changelog.ts`：关于页的「网站沿革」

## 功能

- 全站重新设计：米色画纸 / 天空蓝 / 墨黑剪影，深浅色主题（跟随系统或手动切换）
- Pagefind 全文搜索（支持中文），`Ctrl/⌘ K` 或 `/` 唤起
- 写作日历、按分类筛选的归档页，合订本进度
- 文章页：目录高亮、阅读进度条、代码复制、图片放大、系列导航、相关文章
- 自建评论（BBCode，发送时才需要登录）和头像；用户可以自己修改密码、退出其他设备、删除账号
- 管理面板：文章编辑器带修订记录和版本对比；用户管理可以查找、改名、重置密码、强制下线、封禁和删除
- 内容安全策略：页面只运行本站自己的脚本（`src/lib/csp.ts`）
- 作品（`/works/`）：发布 mod 等可下载的文件，每个作品有介绍、图库、链接、相关文章和按版本整理的文件，下载支持断点续传
- 每天自动备份到 GitHub 私有仓库，大文件走 Release 附件，可以从备份恢复
- 自建访问统计：不保存 IP 地址，文章页显示阅读数，管理面板里有趋势、页面、来源和设备的统计
- Cosmo（`cosmo.hhikr.moe`）：站长的 Hermes 助手网页界面，复用 Hermes Desktop 的渲染层，凭本站的 endministrator 登录进入，见 [tools/cosmo/README.md](../tools/cosmo/README.md)
- RSS（`/rss.xml`，旧地址 `/index.xml` 仍可用）、sitemap、Open Graph
- 中文标题使用霞鹜文楷，所有字体本地托管，不依赖 Google Fonts

## 从 Hugo 迁移

旧的 Hugo + Blowfish 版本在 git 历史中。迁移时已经把短代码（`figure` / `alert` / `mask` / `katex`）
和 `\\( \\)` 公式转换成了上面的标准写法；文章 URL（`/posts/<slug>/`、`/tags/…`、`/categories/…`、`/series/…`）保持不变。

## Hermes 前后端与连接器

本地源码已按结构收纳在 tools/hermes/，网页适配保留在 tools/cosmo/。目录、构建和导入边界见 [Hermes 本地源码](../tools/hermes/README.md)。
