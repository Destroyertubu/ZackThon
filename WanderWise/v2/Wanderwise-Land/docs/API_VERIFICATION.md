---
title: "知乎接入与官方 Skill 核验记录"
date: 2026-09-09
status: "live-verification-pending"
---

# 接口核验：已实现不等于已联调

## 本轮实际发生了什么

用户提供了官方能力说明、需求书中的接口契约、官方 Skill ZIP 地址和一项 key。执行环境无法从外网成功取得 ZIP 或执行真实知乎内容请求。没有获得 live search/list/detail/AI 成功响应，也没有验证 key 类型、权限、额度或有效性。**不能声明已下载、安装或阅读指定 Skill 包。** 当前代码以用户提供的契约为依据，已通过模拟响应测试。

外部网页另行核对了 [MDN WebGL2](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext)、[FastAPI 静态文件](https://fastapi.tiangolo.com/tutorial/static-files/) 和 [KayKit 官方作者页](https://kaylousberg.itch.io/kaykit-forest)。这些资料支持技术/素材选择，不能替代知乎接口实测。

## 已编写的适配器

| 能力 | 请求契约来源与实现 | 本轮验证 |
| --- | --- | --- |
| 知乎搜索 | 用户需求书：`GET https://developer.zhihu.com/api/v1/content/zhihu_search`，`Query`、`Count`，Bearer 与秒级时间戳 | 模拟数据通过；长 ID、追踪参数、HTML 清洗、摘要边界已测；未真实请求成功 |
| 知识目录 | 用户需求书：`GET https://api.zhihu.com/km-indep-home/hackathon/v2/knowledge/list`，无鉴权 | 模拟数组字段映射通过；未确认当日线上结构 |
| 知识详情 | 用户需求书：同一目录下 `knowledge/{work_id}`，无鉴权 | 从列表校验 ID；模拟 chapter 覆盖与字段映射通过；未获得真实正文 |
| 直答合成 | 用户需求书：`POST https://developer.zhihu.com/v1/chat/completions`，model/messages/stream | 输出引用校验测试通过；默认 `zhida-fast-1p5` 未验证账号可用性；实际响应结构须再核验 |
| OAuth/用户数据 | 未启用 | 缺 App ID/App Key、稳定身份和安全回调实测；不猜造账号登录 |
| 热榜/故事/全网搜索/发布 | 本版未实现 | 不因官方有能力就宣称产品已接入；没有任何发布接口调用 |

搜索返回的 ContentText 是摘要，不生成声称覆盖全文的场域。活动详情没有返回 URL 时只展示 work_id、作者和活动来源，不拼造知乎文章 URL。

## 核验步骤

先停止运行中的应用；核验脚本会初始化同一数据库，启动恢复逻辑会把遗留进行中任务标成中断。切勿在另一个应用实例仍处理任务时启动此工具。

```bash
.venv/bin/python tools/download_official_skill.py
.venv/bin/python tools/verify_zhihu.py --prompt-key --search "如何培养学习能力" --first-work
```

官方 Skill 精确下载地址：

[0.5.3-beta.20260904115023 官方 ZIP](https://developer-cdn.zhihu.com/zhihu-cli/releases/beta/skill/0.5.3-beta.20260904115023/zhihu-cli-skill-0.5.3-beta.20260904115023.zip)

下载器不执行其中脚本，拒绝目录穿越、符号链接和超限包；保存的 SHA-256 是本次下载校验值，不是官方签名。下载成功后阅读实际官方 Skill、HTTP 与黑客松相关文件，并对照修订适配器。

核验命令读取：一条指定搜索、一份目录、一个明确选择的正文。`--first-work` 是选择第一项，不代表它一定适合论述。也可使用已查得的 ID：

```bash
.venv/bin/python tools/verify_zhihu.py --work-id "从真实目录复制的作品ID"
```

报告写入 `reports/live_verification_*.json`，只含脱敏状态、ID、标题、范围、来源时间与安全错误，不含 key 或整篇正文。成功搜索写入真实缓存推荐路线；成功知识详情也登记可复用路线。工具不调用 AI、不发布、不自动持续重试。

## 实际默认预算

应用设置搜索缓存 24 小时、目录 24 小时、知识正文 7 天；搜索日预算默认 1000，AI 默认 50，低于用户通知所述能力上限；这些是**应用自身预算**，不是官方保证额度。每访客每类生成任务每小时默认 10，工作线程 2，总排队上限 24。上游失败不会伪装成空结果，默认无自动重试。

正式上线按账号当日真实额度调整环境变量。不要每次点击都查询官方额度，更不要并行对每个话题重复搜索。

## 能称为“真实接入通过”的最低证据

保存一份实际成功的搜索脱敏报告、一份真实目录和正文核验报告；选择 `canEnterField=true` 且人工确认适合的正文，浏览器实际进入并返回场域；刷新后仍可读取正确时间和来源；再对一次真实 AI 生成校验材料 ID 与作者归属。报告不包含完整正文或凭证。

完成这些仍不等于全部 P0：公网 HTTPS、浏览器 3D、持久卷重启、性能和新用户测试还需分别验收。
