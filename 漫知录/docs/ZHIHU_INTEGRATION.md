# 知乎接口接入：已核实部分与待核实部分

## 1. 本次能确认什么

核对日期：2026-09-08。官方开发者平台公开索引文档给出的搜索示例：

```bash
curl -G 'https://developer.zhihu.com/api/v1/content/zhihu_search' \
  --data-urlencode 'Query=如何发现自己的兴趣' \
  -H 'Authorization: Bearer <your_access_secret>' \
  -H "X-Request-Timestamp: $(date +%s)" \
  -H 'Content-Type: application/json'
```

来源：https://developer.zhihu.com/ 。文档明确时间戳单位是秒，不是毫秒；Access Secret 从开放平台个人中心获取。此请求定义与浏览器知乎 OAuth 用户身份不是同一件事。

`backend/content.py` 中 `_http()` 按这个请求实现：固定官方 HTTPS 地址、固定 `Query` 参数、服务端时间戳、服务端 Bearer、禁止跟随重定向、超时以及错误映射。不额外猜测分页、Count、Scope 等未核验字段。

## 2. 官方 Skill 的真实取得状态

用户提供的包：

https://developer-cdn.zhihu.com/zhihu-cli/releases/beta/skill/0.5.3-beta.20260904115023/zhihu-cli-skill-0.5.3-beta.20260904115023.zip

2026-09-08 已成功下载并阅读此版本，安装到开发者的 Agent 技能目录，并完成官方 CLI 初始化。项目里的 `vendor/official-skill` 为被 Git 忽略的本地参考资料，不包含凭证。`fetch_official_skill.py` 仍只负责下载与安全展开，不执行包内命令。

下载脚本的 SHA-256 仅用于标识取得的文件；因为没有官方预公布摘要，不能把这个摘要称为“官方签名验证”。接入前请人工查看 Skill 的完整说明、只读命令与凭据保存位置。

## 3. 响应契约

本版按官方 Skill 核对了搜索结果的 `Data.Items`、`Title`、`Url`、`ContentText` 和 `AuthorName`。默认归一化器兼容这些字段，`schema.example.json` 可显式指定映射：

```json
{
  "_notice": "依据官方 Skill 0.5.3 的搜索响应约定",
  "items": "Data.Items",
  "title": "Title",
  "url": "Url",
  "summary": "ContentText",
  "author": "AuthorName"
}
```

保存经过核验的映射到服务器本地文件，然后配置：

```dotenv
ZHIHU_SCHEMA_FILE=backend/schema.example.json
```

该映射文件随项目提供。检测不到列表结构、没有安全的知乎来源链接、业务错误或字段错配时，接口返回错误，`demoFallback` 为 `false`。合法的空结果列表保持空列表，不凭空补充答案。

没有来源 URL 的文本不会进入“真实知乎内容”结果。`https://zhihu.com.evil.example`、userinfo、非 HTTPS、控制字符、不合预期端口均被拒绝。

### 归一化 Fragment

```json
{
  "id": "URL和摘要的稳定哈希",
  "nodeId": "所属话题节点",
  "title": "接口返回标题",
  "text": "供浮现卡片使用的短摘要",
  "body": "接口实际返回的较长摘要，而非编造的全文",
  "author": "接口作者或明确注明未返回",
  "url": "https://www.zhihu.com/...",
  "kind": "search_summary",
  "source": "zhihu",
  "provenance": "知乎搜索摘要 · 非经核验的逐字引文",
  "retrievedAt": 0,
  "verifiedQuote": false
}
```

`retrievedAt=0` 仅为示意；实际运行写入秒级时间戳。完整搜索结果不被送往前端作为可执行 HTML，而是先转成纯文本。前端通过 `textContent`/文本节点展示。

## 4. CLI 桥接是可选项

推荐本机使用已初始化的官方 CLI：

```bash
python run.py --live
```

启动器会定位官方 CLI，并加载 `backend/schema.cli.json`。自定义接入仍可配置：

```dotenv
ZHIYE_PROVIDER=cli
ZHIHU_CLI_PATH=/absolute/path/to/your/verified/official-cli
```

`schema.cli.json` 已配置 `cli_readonly_confirmed: true` 及官方只读参数 `search zhihu --query {query} --count 6`；成功 stdout 保持官方 JSON 响应结构。系统凭据由 CLI 自行取得，应用不导出钥匙串，也不把凭证交给浏览器。

实现使用 `asyncio.create_subprocess_exec`，不经过 shell；固定可执行文件与参数模板只来自服务器配置。不得把 Access Secret 放在命令参数里，不要允许浏览器上传 argv 或 executable。

## 5. 缓存与额度

按用户提供的官方比赛说明，搜索预算需要站在开发者整体调用次数上规划。本项目默认 `ZHIHU_SEARCH_DAILY_LIMIT=5000`，同时给每个匿名访客自定 `80` 次实时缓存未命中预算。全网搜索与直答没有接通，不混用三种额度。

请求流程：

```text
本地 SQLite 已保存的查询结果（默认不过期）
  └─ 直接返回，不扣实时预算
缓存未命中
  └─ 相同查询加入已有 in-flight 任务
     或发起一个新任务
        └─ 原子预留访客与开发者预算、发起一次官方请求
           └─ 清洗、记录来源与抓取时间，持久写入本地 SQLite
```

默认 `ZHIYE_CACHE_SECONDS=0`：本地优先，缓存不自动过期；旧版按 6 小时写入、已过期但仍保留在数据库中的结果也可复用。相同查询跨世界与访客共享；服务重启、重新进入话题和已达每日预算上限时，仍可读取已保存的结果。缓存命中不会扣任何查询预算。合法空列表也会保存，上游错误不会作为内容缓存。

已用真实缓存验证：重启服务、更换为新访客后再次请求同一查询，返回原有 6 条内容，`cached=true`，开发者和访客预算增量均为 0。见[持久缓存验证结果](../previews/v11/persistent-cache-smoke.json)。

只有显式设置正数 `ZHIYE_CACHE_SECONDS` 时才启用按秒计的自动过期策略；更新内容将消耗新的调用次数。缓存位于 `data/zhiye.sqlite3`（或 `ZHIYE_DB` 指定位置），保存已归一化的标题、摘要、作者、来源 URL 与抓取时间。浏览器 IndexedDB 另存当前旅程和已加载内容；它不替代服务端的全部搜索缓存。

计数按北京时间自然日划分；访客 80 次是本应用自定配置，不宣称为官方规定。请求失败也不返还已预留的开发者预算，是偏保守的实现，因为无法确定上游是否已计费/计数。

进程内 singleflight 适用于当前单进程运行方式；数据库额度是原子的。多实例部署必须增加 Redis 等共享缓存与分布式合并机制，且所有服务实例应共享同一开发者额度来源。

## 6. 验收步骤

先在 `demo` 模式完成 UI 操作，不消耗平台额度。下载并阅读 Skill，取得真正授权的 Access Secret，在开发者平台核查可用权限；不要把密钥发给前端。

配置 `live` 和字段映射，运行一次显式探测：

```bash
python scripts/probe_zhihu.py --live --query "如何发现自己的兴趣"
```

探测只输出模式、命中情况、条数和来源类型，不打印密钥或原始完整响应。再手工核对每条返回结果的原文链接、作者以及“摘要”标签，检查 401/403/429、空结果、超时和额度耗尽。

2026-09-08 已通过 `run.py --live` 启动真实服务，并由应用调用官方 CLI 完成一次未命中缓存的知乎搜索：HTTP 200，返回 6 条 `source=zhihu` 内容，全部具备标题、摘要和知乎原文链接。凭据由 CLI 从系统凭据库获取，未写入项目。脱敏的统计结果见 [live-smoke.json](../previews/v11/live-smoke.json)。这验证了当前账号的一次成功搜索，不代表已验证所有官方能力、权限和上游错误场景；契约单测仍使用人工样本。

## 7. 其他官方能力的接入优先级

优先完成知乎 OAuth：它解决活动登录计数与真实用户身份，不能用本地访客 Cookie 替代。然后再考虑用已授权关注流优化“候选方向”；仍保留换立场与跨界方向，不直接把关注流复制成算法推荐墙。

热榜可作为可选起点，而不是默认接管用户的问题。直答可以用于用户主动触发的组合解释，但必须保留来源、反例与不确定性，不得自动为每个移动帧调用。故事和知识接口在核验授权范围与具体参数后，再作为独立内容类型纳入 provider。

当前没有实现以上功能，不创建看似成功的占位接口，也不会向知乎批量发文。
