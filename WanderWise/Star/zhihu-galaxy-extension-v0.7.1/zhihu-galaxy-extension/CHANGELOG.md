# v0.7.0 — 2026-09-10

- 恢复真正 XYZ 透视呈现；不再对投影后的节点作二维排斥或对摘要作屏幕卡片排版。
- 增加三维力布局、引力/斥力/节点比例/旋转/缩放/选段尺寸等参数，支持冻结和重新舒展。
- 回答原文采用世界锚定的全息平面，包含透视缩放、深度遮挡、静态扫描线与选段收藏。
- 三套主题：深空科技、日落潮汐、雾色花园；七通道自定义与配色导入导出。
- 可选两阶段 AI：一次关键词扫描、本地倒排召回、一次候选复核，每词最多 8 个精选回答；稳定节点 ID、原文校验、取消、撤销、失败回退。
- 独立扩展 AI 设置页：供应商/Base URL/模型/密钥/授权/请求预算。默认关闭、会话密钥、可选本机保存、按需域名授权。
- 所有候选和展示共用最多赞/最新/固定种子随机优先级。保留 v0.6 知识行囊与三维航迹，补齐画像占位 Schema。
- bridge 升级握手，停用默认旧 zhida 整批提炼，防止 AI 未授权时运行另一套远程流程。
- 58 项 Node 测试、30 项离线 Chromium 交互检查通过。正式知乎和付费 API 仍需用户环境验证；测试无真实用户数据和密钥。

---

# v0.6.0 — 2026-09-10

- 合并稳定摘要与多视角布局改进，新增主题目录、搜索和阅读筛选。
- 新增本地知识行囊、选段收藏、笔记、结构化导入导出和探索航迹。
- 新增低动态操作模式，保留用户画像代码接口（未实现推断，暂无独立 JSON Schema 文件）。
- 附带上一轮离线测试报告；正式知乎页面端到端验证待完成。
- 此包包含运行所需脚本、样式、图标、演示页面及原版后端目录。

---

# Changelog

## 0.5.0

- Removed the six-page answer-fetch ceiling; browser pagination now follows `maxAnswers` up to 500.
- Raised bridge answer limits to 500 and expanded semantic sampling to a head-plus-long-tail sample of up to 48 answers.
- Increased semantic targets to 16–24 overview themes and 24–48 phenomena, with literal evidence anchors for later answer assignment.
- Rebuilt answer satellites around a one-answer-one-node invariant. Every loaded answer receives exactly one green satellite, while optional secondary semantic links are preserved without duplicating the answer.
- Added evidence-profile similarity assignment so answers outside the zhida evidence sample still cluster around relevant themes/phenomena.
- Added fallback answer orbit around the question core when local semantic extraction is temporarily empty.
- Added clickable theme descendants in the side panel and canvas branch expansion for selected themes.
- Fixed over-aggressive cross-level de-duplication: exact/nearly identical blue-purple labels are removed, but legitimate refinements such as `校园招聘 → 校园招聘信息差` remain.
- Strengthened conversational-fragment filtering and recurring-support requirements for large local corpora.
- Existing answer satellites can smoothly drift to refined semantic clusters when high-quality semantics arrives, without disappearing or duplicating.
- Status now reports loaded answers, theme count, phenomenon count, and actual answer-node count separately.

## 0.4.0

- Reframed overview nodes from raw frequency keywords to evidence-grounded semantic themes; zhida may synthesize concise theme labels instead of requiring literal text matches.
- Strengthened the refinement prompt around one-glance coverage, orthogonal themes, and compact mechanism/issue labels.
- Added stricter conversational/generic filters and a conservative local fallback that prefers topic-like noun phrases and keeps only six initial high-confidence themes.
- Introduced stable semantic IDs and append-only graph merging. Once a theme, phenomenon, or answer satellite appears, progressive updates never remove it.
- Existing nodes keep their coordinates while new nodes fade in; support counts and evidence can still be enriched in place.
- Removed rank-dependent keyword-label hiding that could make labels appear to vanish as batches changed.
- Answer opening-sentence callouts now always appear for a hovered/selected answer, and up to five local answers when a phenomenon is focused.
- Restyled answer opening sentences as warm-gold callouts with connector lines, making the finest-grain viewpoint visually explicit.
- Refined theme nodes render slightly larger/brighter than local fallback nodes without hiding the fallback nodes.

## 0.3.0

- Added semantic color coding: blue keywords, purple phenomenon nodes, cyan answer satellites, plus an always-visible legend.
- Replaced blocking startup with progressive loading. The galaxy opens from the best currently available answers and keeps growing while web/API/zhihu-cli work finishes in the background.
- Default first-preview target is 20 top-voted answers; fallback gate prevents a long blank loading screen when fewer are immediately available.
- Added persistent loading settings: top-voted/latest, preview threshold, batch size, and max answers.
- Changing sort mode or increasing max answers can trigger more collection immediately.
- Extended answer metadata support with created/updated timestamps and compact vote-count parsing.
- Added first-paragraph-first-sentence extraction. When <=5 answer satellites are visible, their opening viewpoint is rendered beside the point.
- Added answer opening sentence to the detail panel.
- Fixed vertical zoom scale direction and wheel zoom semantics; nearest zoom distance intentionally unchanged.
- Bridge timeout no longer cuts off the longer semantic-refinement request while the UI waits; refinement now completes asynchronously.

## 0.2.0

- Official zhihu-cli/Open Platform local bridge added; merges official search, page hydration, DOM answers and best-effort web answers.
- Optional zhida-fast-1p5 semantic refinement with evidence-bound structured keywords/phenomena.
- Strict Answer-object detection to prevent hydration metadata from entering NLP.
- Aggressive URL/HTML/JSON/media metadata cleaning; blocks src/com/jpg/data/vN/api and related tokens.
- Replaced unrestricted adjacent-token merging with constrained Chinese compound recovery.
- Added low-information/common phrase filters and phenomenon phrase length/boundary constraints.
- Long sentence fragments are no longer emitted directly as phenomenon nodes.
