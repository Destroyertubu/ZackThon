# 镜海群岛内容服务

Node 24 + 官方知乎 CLI + `node:sqlite`，不新增运行依赖。由 `server/index.ts` 初始化，继续使用现有 Express 单进程部署。

## 公共接口

- `GET /api/search?q=关键词&provider=zhihu|global`：搜索摘要，默认永久复用本地缓存；仅显式 `refresh=true` 重新检索。
- `GET /api/hot`：热榜摘要，使用相同持久缓存，页面不会导致自动刷新。
- `GET /api/explore?q=关键词`：保持原星系响应结构，内部改接统一内容服务。
- `GET /api/questions/:questionId?q=原关键词`：从本次探索中选出的真实问题，调用官方 `question answers`，保留题目归属。文章和知识主题不假装成问题。
- `GET /api/answers/:answerId/highlights`：公共阅读使用原文摘要的确定性精华提取，不消耗 AI 预算。
- `POST /api/access`，JSON `{ "code": "访问码" }`：设置两小时 HttpOnly / SameSite 会话，只返回有效期。会话与 loopback、Cloudflare 转发地址无关。
- `POST /api/synthesis`：`{ mode: "idea" | "journey", prompt, sourceIds?: string[], personalText?: string, realmId?: string }`；需访问码会话。返回 `{ draft: { id, mode, text, sources, generatedAt, realmId? }, provider, notice }`。

统一搜索响应包含 `items, cached, fetchedAt, notice`。每个条目包含 `id, title, author, summary, url, source, kind, fetchedAt, contentType`，可确认时另有 `questionId`。`search_summary`、`answer_summary`、`hot_summary` 均不是全文。精选清单使用 `curated`，也是导读摘要。

来源 ID 与星系一致：`answer-编号`、`question-编号`、`article-编号`；外部网页为规范 URL 的哈希。精选来源保持 `curated-xxx`。AI 的 `sourceIds` 只接受服务端已有来源，个人笔记通过用户主动选择的 `personalText` 单独提交。生成结果不写入公共缓存。

## 本地状态与配置

默认数据目录为 `artifacts/content-service`，已被项目忽略规则覆盖：

- `content.sqlite3`：公开摘要快照、来源目录、调用预算及单向哈希会话。
- `.env.access.local`：JSON 格式的随机邀请访问码与签名种子，文件权限 0600。使用 `.env` 前缀也能命中 Vite 开发服务器的默认拒绝访问规则，不会输出到日志或响应。

可配置环境变量：

| 变量 | 默认值 |
| --- | --- |
| `ZHIHU_CLI_PATH` | 当前用户 `Library/Application Support/zhihu-cli/current/zhihu-cli` |
| `CONTENT_DATA_DIR` | 项目 `artifacts/content-service` |
| `CONTENT_DAILY_GLOBAL` | 200 |
| `CONTENT_DAILY_VISITOR` | 20 |
| `AI_DAILY_GLOBAL` | 50 |
| `AI_DAILY_CODE` | 10 |
| `LEGACY_ZHIHU_DB` | 不自动探测；指定后执行一次公共缓存迁移 |

预算按 UTC 日期归档，重启保留计数。发起上游尝试前，访客与全站额度在同一 SQLite 事务内预留；上游失败仍算一次尝试。相同在途检索合并，缓存命中不计数。AI 并发上限为两次，忙碌拒绝不占额度。

访问码允许的能力仅为 AI 合成；`me`、私人知识库、本人创作/关注/收藏接口没有服务端路由。官方 CLI 只通过 `execFile`、固定命令和独立参数数组调用，`shell:false`。认证凭据继续由官方 CLI 钥匙串读取，应用不导出密钥。

## 本轮验证（2026-09-13）

- 12 组新增测试 + 33 组原服务端测试全部通过。
- 新增测试覆盖重启缓存、并发合并、原子预算、预算跨日、失败保留缓存、摘要与题目边界、恶意命令文本、会话过期、AI 两并发、未知来源拒绝、公共缓存迁移、HTTP 同源和输入校验。
- 专属 TypeScript 严格检查、ESLint 通过。
- 实际知乎搜索“文学 摄影 落日”返回 10 条；实际问题 `1931487602172749242` 的回答接口返回 20 条。后续独立进程检查全部为 `cached:true`，没有再次调用上游。
- 一次实际知乎直答使用 `curated-walden` 公开材料，生成 658 字草稿，来源 ID 与 Gutenberg URL 校验通过，未上传私人笔记。
- 旧漫知录数据库仅查询 `cache` 表，迁移 13 组公开检索。原数据库未修改，个人表未查询。
- 当前 4187 进程与公网隧道未在此子任务重启；由主任务完成构建与最终部署。

命令：

```sh
npx tsx --test server/content/*.test.ts server/galaxy/*.test.ts
npx tsx scripts/content-live-check.ts
npx tsx scripts/content-ai-check.ts
```

后两条默认只读取已保存证据或缓存。显式加 `--live` 才允许新的真实调用；真实调用均走应用预算，避免反复核验消耗上游额度。
