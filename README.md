# hhikr.moe

hhikr 的个人网站 —— <https://hhikr.moe>

v2 起使用 [Astro](https://astro.build) 构建，仍然是纯静态站点（`npm run build` → `dist/`）。

## 开发

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # 类型检查 + 构建 + 生成搜索索引
npm run preview      # 预览构建结果（搜索只在构建后可用）
npm run new -- my-post "标题" --category StudyBase --series 笔记-操作系统
```

部署（rsync 到服务器，需先配置 SSH 密钥）：

```bash
DEPLOY_HOST=1.2.3.4 ./scripts/deploy.sh
```

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
