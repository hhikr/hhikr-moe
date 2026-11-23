# VPS 运行、发布与清理

入口：[README](../README.md)。本页描述实际运行拓扑和操作顺序；凭据值不写入 Git。发布记录应标明 main 提交、产物摘要、原/新发布入口与实际验收结果。

## 当前服务拓扑

| 服务 | 入口 / 运行目录 | 配置与数据 |
| --- | --- | --- |
| `hhikr-web.service` | Node `dist/server/entry.mjs`，`/srv/hhikr/app/current`，回环 4400 | `/etc/hhikr-web/env`；`/srv/hhikr/data/` |
| `caddy.service` | HTTPS/反向代理 | `/etc/caddy/` |
| `hot100-judge.service`（2026-11-22 上线） | Node `tools/hot100-judge/server.mjs`，`/srv/hot100/current`，回环 4310；Caddy 转发 `/api/hot100/*` | `/etc/hot100/env`；`/var/lib/hot100`；`/opt/hot100/jdtls`。上线与回滚见 [tools/hot100-judge/deploy](../tools/hot100-judge/deploy/README.md) |

实际 ExecStart、环境文件和 current 目标以 `systemctl show`、`readlink -f` 核对，不从 Git 推断。

网站 release 在 `/srv/hhikr/app/releases/`。当前与回滚版本都应保留。

Hermes/Cosmo 助手（`hermes-hhikr`、`hermes-hhikr-gateway`、`cosmo-gate` 三个服务，`/opt/hermes-hhikr`、`/srv/cosmo` 等目录，以及 `cosmo.hhikr.moe` 站点）已经下线并删除。

## 发布准备

1. 在 Windows main 核对 clean status；按 [README](../README.md) 运行测试和网站构建。
2. 只打包明确的代码/构建产物，不打包数据、登录或 Windows node_modules。网站包用 `scripts/package-main-release.py` 生成，内容与核对项见 [网站发布包](WEBSITE_RELEASE_RUNTIME.md)。
3. 比较 VPS 最新源码、依赖锁与运行版本。Linux 依赖若可复用就复用；若必须安装，说明具体生产依赖并取得批准。VPS 不重新做开发构建。
4. 列出服务、配置/源码目标、预计中断、回滚入口和清理清单，确认后才修改生产。
5. 保存原入口与所改文件的备份、摘要。不要顺便改代理、域名、用户或访问权限。

## 切换与验收

网站使用新 release + 原子切换 current；失败切回原入口并重启服务。网站保留外部数据库和上传，不把新构建的开发数据带过去。部署权限只授予运行公开代码所需的读取能力，秘密文件仍留原处。

重启网站会短暂影响访问。验收至少包括网站 `/api/health`、主要页面、静态文件，以及进程 cwd 指向新 release。登录账号和 Google 返回保留独立的用户验收记录；不要自动发起真实登录。

## 清理准则

先核对大小、进程引用、脚本/服务依赖和是否有未归拢工作，再申请具体删除范围。优先清理缓存与无用构建，不删除生产数据或可用回滚版本。

不要直接运行带自动旧版本清理的发布脚本。原本机私有 `tools/deploy/release.sh` 会删除较早的 release；使用前需审查并将发布与清理分开。服务器部署脚本和 systemd 配置的变更须具体批准。

## 文档与秘密

本页公开路径、职责和流程；真实 env、服务秘密、备份与私有部署材料在外部。发布后更新实际记录，下一次先重新核对服务与文件。
