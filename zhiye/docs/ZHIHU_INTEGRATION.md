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

本次工具环境无法成功下载此 ZIP，未读取其内容，也没有安装到 agent。不能据此声称掌握 2026-09-04 新增故事、知识接口的精确请求参数。`fetch_official_skill.py` 只做下载与安全展开；失败时明确退出，绝不下载替代包、生成伪 Skill 或自动执行包内命令。

下载脚本的 SHA-256 仅用于标识取得的文件；因为没有官方预公布摘要，不能把这个摘要称为“官方签名验证”。接入前请人工查看 Skill 的完整说明、只读命令与凭据保存位置。

## 3. 响应契约

本版提供一个保守的兼容归一化器，可以识别常见的 `data/items/results` 容器及 title/url/summary/author 等字段；这只是适配策略，不是官方 beta 响应保证。`schema.example.json` 演示如何指定路径：

```json
{
  "_notice": "映射格式示例；务必用真实样本核验",
  "items": "Data.Items",
  "title": "Title",
  "url": "Url",
  "summary": "Summary",
  "author": "Author.Name"
}
```

保存经过核验的映射到服务器本地文件，然后配置：

```dotenv
ZHIHU_SCHEMA_FILE=backend/schema.verified.json
```

上面这个文件名是你本地创建的映射文件，不在交付包中假装存在。检测不到列表结构、没有安全的知乎来源链接、业务错误或字段错配时，接口返回错误，`demoFallback` 为 `false`。合法的空结果列表保持空列表，不凭空补充答案。

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

默认 HTTP 不依赖 CLI。只有本地已经安装、初始化并核验了官方 Skill，才考虑：

```dotenv
ZHIYE_PROVIDER=cli
ZHIHU_CLI_PATH=/absolute/path/to/your/verified/official-cli
```

在经核验的 schema 文件中填写 `cli_search_args` 字符串数组，以 `{query}` 表示唯一的用户查询替换位置；另设 `cli_readonly_confirmed: true`，表明开发者已检查命令确实只读。**此处不写猜测的子命令/参数示例。** 真实 argv 必须来自下载后的 Skill，不从本说明推断。

实现使用 `asyncio.create_subprocess_exec`，不经过 shell；固定可执行文件与参数模板只来自服务器配置。不得把 Access Secret 放在命令参数里，不要允许浏览器上传 argv 或 executable。

## 5. 缓存与额度

按用户提供的官方比赛说明，搜索预算需要站在开发者整体调用次数上规划。本项目默认 `ZHIHU_SEARCH_DAILY_LIMIT=5000`，同时给每个匿名访客自定 `80` 次实时缓存未命中预算。全网搜索与直答没有接通，不混用三种额度。

请求流程：

```text
已缓存的话题内容
  └─ 直接返回，不扣实时预算
缓存未命中
  └─ 原子预留访客预算
     └─ 相同查询加入已有 in-flight 任务
        或原子预留开发者预算、发起一次官方请求
           └─ 清洗、记录来源、缓存 6 小时
```

计数按北京时间自然日划分；6 小时和访客 80 次都是本应用的配置，不宣称为官方规定。请求失败也不返还已预留的开发者预算，是偏保守的实现，因为无法确定上游是否已计费/计数。

进程内 singleflight 适用于当前单进程运行方式；数据库额度是原子的。多实例部署必须增加 Redis 等共享缓存与分布式合并机制，且所有服务实例应共享同一开发者额度来源。

## 6. 验收步骤

先在 `demo` 模式完成 UI 操作，不消耗平台额度。下载并阅读 Skill，取得真正授权的 Access Secret，在开发者平台核查可用权限；不要把密钥发给前端。

配置 `live` 和字段映射，运行一次显式探测：

```bash
python scripts/probe_zhihu.py --live --query "如何发现自己的兴趣"
```

探测只输出模式、命中情况、条数和来源类型，不打印密钥或原始完整响应。再手工核对每条返回结果的原文链接、作者以及“摘要”标签，检查 401/403/429、空结果、超时和额度耗尽。

本次交付没有条件完成上述真实鉴权验收。应保存脱敏的真实响应样本，替换当前测试中的人工样本，补充契约回归测试。

## 7. 其他官方能力的接入优先级

优先完成知乎 OAuth：它解决活动登录计数与真实用户身份，不能用本地访客 Cookie 替代。然后再考虑用已授权关注流优化“候选方向”；仍保留换立场与跨界方向，不直接把关注流复制成算法推荐墙。

热榜可作为可选起点，而不是默认接管用户的问题。直答可以用于用户主动触发的组合解释，但必须保留来源、反例与不确定性，不得自动为每个移动帧调用。故事和知识接口在核验授权范围与具体参数后，再作为独立内容类型纳入 provider。

当前没有实现以上功能，不创建看似成功的占位接口，也不会向知乎批量发文。
