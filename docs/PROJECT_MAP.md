# 代码地图与调用关系

入口：[README](../README.md)。本页列当前源码位置；部署副本见 [VPS 运维](VPS_RUNBOOK.md)，配置与真实数据见 [配置与数据](CONFIGURATION.md)。

## 网站

| 路径 | 责任 |
| --- | --- |
| `src/pages/`、`src/components/`、`src/layouts/`、`src/styles/` | Astro 页面、组件、布局和样式 |
| `src/server/` | 网站数据库、账号、内容、统计、备份与机器读数 |
| `src/site.config.ts`、`src/data/changelog.ts` | 公开站点信息与沿革 |
| `scripts/`、`tests/server/` | 内容/构建/运维辅助与服务端测试；DNS 工具测试只用离线样例 |
| `src/content/posts/` | 数据库迁移前文章原件；生产文章在数据库中 |

## 服务

- `tools/hot100-judge/`：Hot 100 在线判题与 Java 智能提示服务（沙箱编译运行、隐藏用例、JDT LS），部署见其 `deploy/`；`tools/hot100-java/LessonIO.java` 是判题时的输入输出辅助类。

## 已下线

Hermes/Cosmo 助手（聊天页、`/admin/` 管理页、Telegram 网关、定时任务）、任务插件与 Android 应用、Windows 连接器已经下线。数据库迁移 `009_retire_assistant` 删除了它们在网站数据库里留下的表。
