# hhikr.moe

hhikr 的个人网站 —— <https://hhikr.moe>

v2 起使用 [Astro](https://astro.build) 构建，以 Node 服务的形式运行：`npm run build` 生成 `dist/client/`（预渲染页面和静态文件）与 `dist/server/`（服务入口）。

## 开发

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # 类型检查 + 构建 + 生成搜索索引
npm run preview      # 预览构建结果（搜索只在构建后可用）
npm run new -- my-post "标题" --category StudyBase --series 笔记-操作系统
```

网站已部署到 ByteVirt VPS，通过 NameSilo 管理 `hhikr.moe` 解析，使用 Caddy 提供 HTTPS。完整的构建、上传、服务器配置、DNS、证书、验收和回滚流程见 [部署与维护](tools/deploy/README.md)。独立加密代理的配置、验证范围和连接方法见 [VPS 代理](tools/deploy/proxy.md)。

## Hot 100 学习区

导航中的“算法”进入 `/hot100/`。100 道题按 17 个分类组织，每题提供 Java 解法、输入输出说明、自定义输入动画和编程练习。动画支持 `A` 后退、`D` 前进；主题切换支持匀速扩散和中途反向。

编译运行和类型提示通过本机 Java 服务提供。练习页可下载服务包，连接说明见 [本机 Java 服务](tools/hot100-java/README.md)，方法式练习与标准输入说明见 [Java 练习输入输出](tools/hot100-java/practice-guide.md)。网站保持静态部署，Java 程序在用户自己的电脑上执行。

```bash
npm run test:hot100   # 课程、算法、动画与结果比对验证
npm run java:package # 从 tools/hot100-java 生成下载包
npm run java:serve   # 启动允许 https://hhikr.moe 连接的本机服务
```

服务需要 Node.js 和包含 `javac` 的 JDK。项目内调试其他网站来源时，执行 `node tools/hot100-java/server.mjs --site http://localhost:4321`，并在网页填写相同端口。

## 写文章

每篇文章是一个文件夹：`src/content/posts/<slug>/index.md`，图片放在同一个文件夹里，用相对路径引用即可，构建时会自动压缩成 WebP。

```yaml
---
title: "第二章 处理器管理"
date: 2025-05-05T21:36:22+08:00
summary: "一句话简介"
category: "StudyBase"        # StudyBase / TechPlay / Echoes，见 src/site.config.ts
tags: ["笔记", "操作系统"]
series: "笔记-操作系统"        # 可选：合订本
seriesOrder: 2               # 可选：在合订本中的顺序
cover: ./featured.png        # 可选：封面
draft: true                  # 可选：草稿（带标记显示，不进 RSS）
updated: 2026-10-08          # 可选
comments: false              # 可选：关闭评论
---
```

Markdown 扩展语法（与 Obsidian 兼容）：

| 写法 | 效果 |
| --- | --- |
| `$E=mc^2$`、`$$ … $$` | KaTeX 公式 |
| `> [!note]` / `> [!tip] 标题` / `> [!warning]-` | 提示框（`-` 折叠，`+` 可折叠但展开） |
| `\|\|剧透\|\|` | 点击显示的遮罩文字 |
| `![说明](pic.png "图注")` | 带图注的插图，可点击放大 |

## 配置

- `src/site.config.ts`：站点信息、导航、分类、社交链接、评论（Waline）、统计
- `src/data/links.ts`：友链
- `src/data/changelog.ts`：关于页的「网站沿革」

## 功能

- 全站重新设计：米色画纸 / 天空蓝 / 墨黑剪影，深浅色主题（跟随系统或手动切换）
- Pagefind 全文搜索（支持中文），`Ctrl/⌘ K` 或 `/` 唤起
- 写作日历、按分类筛选的归档页，合订本进度
- 文章页：目录高亮、阅读进度条、代码复制、图片放大、系列导航、相关文章
- Waline 评论与阅读计数（按需加载）
- RSS（`/rss.xml`，旧地址 `/index.xml` 仍可用）、sitemap、Open Graph
- 中文标题使用霞鹜文楷，所有字体本地托管，不依赖 Google Fonts

## 从 Hugo 迁移

旧的 Hugo + Blowfish 版本在 git 历史中。迁移脚本 `scripts/migrate-hugo.mjs` 已经把短代码（`figure` / `alert` / `mask` / `katex`）
和 `\\( \\)` 公式转换成了上面的标准写法；文章 URL（`/posts/<slug>/`、`/tags/…`、`/categories/…`、`/series/…`）保持不变。
