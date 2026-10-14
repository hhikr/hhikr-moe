# Cosmo 任务与 Android 开发

本目录保留原来的 `workspace/`、`state/scripts/` 和任务插件目录关系。Hermes 的 Telegram 定制直接归入 `../hermes/source/plugins/platforms/telegram/`，只有一份后端源码；网页桥接和现有原生登录网关在 `../cosmo/`。

`run.py` 把本目录和 Hermes 源码加入 Python 路径，Windows 加载既有 `compat/fcntl.py`。原 `/opt/hermes-hhikr/...` 路径经 `hermes_paths.py` 分别指向仓库源码和外部数据。业务接口、配置变量和现有认证保持原样。

## 测试

在仓库根目录执行，Python 环境依赖见 `requirements-test.txt`；完整 Hermes 的依赖仍以 `../hermes/source/pyproject.toml` 和 `uv.lock` 为准。

```powershell
npm run test:runtime       # 合成规则与临时记录，不读取个人历史
npm run test:cosmo:native  # 现有网关 + 原生登录 + 实际后端鉴权函数
$env:COSMO_TOOLCHAIN_PATHS = '外部 Android 工具链 paths.json 的绝对路径'
npm run test:android      # 合成参数、当前源码、5 组 Java + 权限检查
```

## 外部配置

保留已有目录：`COSMO_DATA_ROOT` 指向仓库外的原项目根，其下仍是 `workspace/activity-coach/state.json`、`history/`、`workspace/sleep-plan/settings.json`、`workspace/task-ledger/` 和 `workspace/phone-control/device-status.json`。Windows 迁移快照只用于本机开发；真实反馈与当前任务继续写入 VPS 权威数据。

`COSMO_RULES_FILE` 指向仓库外的规则 JSON。其字段结构见 `tests/rules.synthetic.json`，其中全部数值是测试样例，不是运营规则。本次已将原源码实际参数保存为本机原开发项目 `workspace/cosmo/source-migration.rules.json`，不进入 Git。

个人参数读取仅替代原先的字面量，保留原来的额度选择、期限、夜间判断、后台音频和任务结果逻辑。Android 的同一组参数编译为忽略目录里的 `PersonalRules.java`，没有新增资产加载协议或同步字段。

## Android 构建与验签

```powershell
$env:COSMO_DATA_ROOT = '仓库外原开发项目根目录'
$env:COSMO_RULES_FILE = '仓库外个人规则 JSON 绝对路径'
$env:COSMO_TOOLCHAIN_PATHS = '仓库外已有工具链 paths.json 绝对路径'
$env:COSMO_SIGNING_DIR = '仓库外已有 android/signing 绝对路径'
npm run android:build
npm run android:verify
```

不设置后两项时，脚本从 `COSMO_DATA_ROOT/workspace/phone-control/` 的原工具链、签名位置读取。构建要求现有 `release.jks` 和 `password`，缺失即停止；不创建新密钥。包名、版本和 alias 沿用原项目。验签比对原 APK 的公开证书与现有 gate 的 App Links，不读取私钥。

产物在本目录 `workspace/phone-control/Cosmo-Focus-<version>.apk`，与 `android/build/`、`test-classes/` 一起被 Git 忽略。本次仍为既有版本的搬迁验收产物，未发布为新手机版本。

## Hermes、任务插件和脚本

`npm run hermes:cli -- <命令>` 运行本仓库 Hermes CLI，`HERMES_HOME` 指向外部配置/登录目录；完整依赖、模型登录与启动流程遵循 Hermes 上游文档。测试入口只提供测试所需的依赖，不能代替完整后端安装。

任务插件保留原加载关系：Hermes 从 `$HERMES_HOME/plugins/cosmo-tasks/` 加载。开发时用独立的外部 `HERMES_HOME`，将本目录 `state/plugins/cosmo-tasks/` 链接或安装到该开发 home；保持运行配置在外部。启用插件、改活动配置或启动服务须另行确认，不覆盖现有运行插件。

单独检查脚本可用 `python tools/cosmo-runtime/run.py state/scripts/activity_daily.py` 或 `state/scripts/sleep_daily.py`；它们读取、写入所设的外部开发数据并输出原任务卡片协议，不安装定时任务。VPS 上已运行的提醒和反馈继续使用原来的权威数据。

可选的搬迁等价核对：设置原个人规则文件后运行 `python tools/cosmo-runtime/run.py tests/verify_equivalence.py <外部原开发项目根>`，比较原/新 Python 判断及原/新 Java 全日可见状态。此检查读取原源码，数据输入是合成记录。

来源及修改理由见 `SOURCE_MANIFEST.json` 和 `ADAPTATIONS.json`；运行 `python tools/cosmo-runtime/verify_sources.py` 核对收纳文件、审核后的摘要和排除边界。
