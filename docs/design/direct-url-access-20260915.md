# 直接网址访问 · 2026-09-15

按用户要求取消访客访问码。浏览器输入网址即可进入，无需登录。

| 入口 | 地址 |
| --- | --- |
| 本机游戏 | http://127.0.0.1:4187/observatory |
| 公网普通版 | https://eau-recorded-gap-decor.trycloudflare.com/observatory |
| RTX 实时云渲染 | https://website-alerts-reservations-gone.trycloudflare.com/ |
| 自动演示与视频下载 | https://range-diploma-exams-jones.trycloudflare.com/showcase |

## 行为

- GPU 网关删除登录页面、登录 Cookie 与过期验证。现有 `/cloud/login` 地址直接跳回首页。同源匿名 WebSocket 与视频请求可使用，内部 Selkies 服务凭据仍仅由网关注入到私有 Unix socket 上游。
- 录制控制台打开即可查看、生成、取消和下载视频；保留单任务互斥、变更请求同源检查和每次独立的浏览器存档。历史两份完整影片继续提供。
- 小屋 AI 合成删除访问码表单与 `/api/access` 接口。自动使用签名访客 Cookie 计入预算，保留每访客每日 10 次、全站每日 50 次与两次并发上限。`AI_DAILY_VISITOR` 可配置，兼容旧 `AI_DAILY_CODE` 的值。
- 沿用原访客签名种子，不清空内容库、收藏、手记或预算；旧邀请码不再读取。知乎 CLI 与上游模型的内部凭据未公开。
- 不调整当前场景、镜头、配音、角色控制及旅程内容。原 GPU 浏览器容器与数据卷保留；仅更新应用服务和网关。

## 验证

- 12 项内容服务测试、43 项原内容接口测试通过；构建、前后端 TypeScript 和相关 ESLint 通过。
- AI 测试使用模拟上游验证匿名首次合成、访客与全站预算、跨站拒绝、旧签名种子兼容，不消耗知乎调用额度。云端 AI 上游原本未配置的状态保持如实报告，取消访问码不等于配置了上游。
- 本机全新浏览器直接进入观星台，真实 Canvas 可见、无密码框、无页面错误；健康接口 `accessRequired: false`。本机与公网 `/home`、`/observatory`、`/galaxy` 匿名返回 200。
- 录制服务 11 项测试通过；全新 Chrome 匿名播放三分钟影片、旧影片下载与 MP4 Range 请求通过。独立 QA 中匿名创建、互斥与取消通过；QA 资源已清理，主控制台保留最新完整影片。

运行证据保存在各工作树的 `artifacts/open-access-20260915/`、`artifacts/showcase/`。原实现与旧访问码说明保留为历史记录，此文描述当前访问行为。

当前 GPU 实时串流的公网 WebSocket 曾返回内部服务 401；按用户要求已暂停视频通道排查。普通公网游戏入口与演示成片播放已验证可直接访问，GPU 入口不列为已完成公网视频验收。
