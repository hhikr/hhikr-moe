# 网站发布包与运行约定

入口：[VPS 运维](VPS_RUNBOOK.md)。本页说明网站发布包里必须有什么，以及打包和上线前要核对的事项。

生产网站有两个入口：服务进程 `dist/server/entry.mjs` 和定时执行的备份脚本 `scripts/backup.mjs`。HTTP 探测通过只说明前者可用，不能说明备份可用。

## 打包

在仓库根目录、main 分支、工作区干净时执行：

```powershell
npm run build
python scripts/test-main-release.py
node --test tests/server/backup.test.mjs
python scripts/package-main-release.py
```

- 打包脚本只生成网站包，产物在 `node_modules/.cache/main-release/`：`website.tar.gz`、分块传输文件、`transfer-manifest.json` 和 `packaging-report.md`。
- 包内文件按白名单收录：`dist/`、依赖锁、备份与搜索重建脚本、`src/server/`、`src/markdown/`、`src/plugins/`。凭据、`.env`、密钥文件和 `tools/deploy/` 一律排除。
- `test-main-release.py` 沿 `scripts/backup.mjs` 的相对导入逐个检查，确认备份运行需要的文件都在包里。
- 判题服务另行打包：`npm run judge:package`，见 [tools/hot100-judge/deploy](../tools/hot100-judge/deploy/README.md)。
- 打包是单独的操作。修别的问题时不要重新生成已经审核过的发布包，因为工作区可能混有其他改动。

## 上线前核对

- 包里有备份入口，以及它依赖的 backup、config、db、migrations、system 模块。
- 修复生产入口之前，确认没有未执行的数据库迁移。
- 公开源码以服务用户可读的权限部署，并以服务用户身份探测导入。
- Linux 依赖放在应用的共享目录，不放进带日期的 release 目录。
- 切换链接前，按文件哈希和符号链接目标核对复制的依赖。
- 删除旧依赖前检查进程映射：原生库在重启前仍被占用。
- 实际跑一次备份，确认备份仓库是私有的，本地与远端提交号一致。
- 保留回滚文件和依赖链接目标；产物里不得含凭据。
