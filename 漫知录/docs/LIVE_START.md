# 用官方 CLI 启动知乎实时模式

官方知乎 CLI 已安装，并且 Access Secret 已由 CLI 保存到系统凭据库后，在项目代码目录执行：

```bash
python run.py --live
```

浏览器打开 <http://127.0.0.1:8000>。macOS 下会自动使用 `~/Library/Application Support/zhihu-cli/current/zhihu-cli`，由官方 CLI 访问其钥匙串凭据。无需将 key 写入项目、命令参数或 `.env`。

如果 CLI 安装在其他位置，显式指定可执行文件的绝对路径：

```bash
ZHIHU_CLI_PATH="/absolute/path/to/zhihu-cli" python run.py --live
```

改用其他端口：

```bash
python run.py --live --port 8001
```

入口会为所选端口设置 `localhost` 和 `127.0.0.1` 的默认允许来源。若系统环境或项目 `.env` 已显式配置 `ZHIYE_ALLOWED_ORIGINS`，原值优先；此时请在该配置中包含实际使用的浏览器来源。

`--live` 为当前服务进程设置 `ZHIYE_MODE=live`、`ZHIYE_PROVIDER=cli`、官方 CLI 路径及 `backend/schema.cli.json` 的绝对路径；保留 `--host`、`--port` 和 `--reload` 用法。它不改写 `.env`，不读取或导出钥匙串，不自动安装或更新 CLI，也不在启动时调用业务 API。未找到可执行 CLI 时会直接报错退出。

进入话题后，后端按需执行 `search zhihu --query <问题> --count 6`。查询作为独立参数传给子进程，不经过 shell。项目会缓存结果并执行现有调用预算；认证失败、额度耗尽或响应不匹配时展示错误，不切换为演示内容。返回结果保留标题、作者、知乎原文链接以及“搜索摘要 · 非全文”的来源边界。

搜索内容持久保存在本机 `data/zhiye.sqlite3`，默认 `ZHIYE_CACHE_SECONDS=0`，优先复用，不自动过期。重新打开页面、重启服务或其他访客搜索同一查询时均可读取本地结果，不再次消耗额度。只有本地缺少对应结果才请求上游。保留 `data` 目录即可保留已下载内容；不要将运行数据提交到 Git。

认证由官方 CLI 管理。当前系统账号需已完成官方 Skill 的初始化；仅安装 CLI 并不等于已认证。系统环境若显式设置 `ZHIHU_ACCESS_SECRET`，仍遵循官方 CLI 的凭证优先级；本入口不会读取、输出或改写它。

不传 `--live` 时，仍遵循项目原有环境配置；未配置 `ZHIYE_MODE` 时默认使用原创演示内容。

接口约定可查看[官方 Skill 下载包](https://developer-cdn.zhihu.com/zhihu-cli/releases/beta/skill/0.5.3-beta.20260904115023/zhihu-cli-skill-0.5.3-beta.20260904115023.zip)和仓库内的[字段映射](../backend/schema.cli.json)。

2026-09-08 已通过此入口完成一次真实搜索，返回 6 条有效内容，见[脱敏验证结果](../previews/v11/live-smoke.json)。
