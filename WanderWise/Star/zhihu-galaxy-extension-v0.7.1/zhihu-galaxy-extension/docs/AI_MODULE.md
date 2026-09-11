# AI 校对模块与预算 · v0.7

## 模块边界

`engine.js` 继续生成无 AI 的本地星系；`ai-semantic.js` 是无密钥、无网络的纯函数模块；`ai-client.js` 控制批次、版本、证据校验、图修改与撤销；`ai-background.js` 只在扩展 service worker 中访问供应商；`ai-settings.*` 是独立扩展来源的凭据页面。`spatial.js` 提供全局排序和稀疏三维布局。

本版只实现 Chat Completions 兼容适配，不依赖供应商 SDK，不远程执行模型返回的代码、链接或工具调用。第一阶段和第二阶段提示词均在 `ai-semantic.js` 的 SYSTEM_SCAN / SYSTEM_SELECT 中，版本指纹为 `repair-0.7.0-1`。

## 本地召回的定义

为每篇已载入正文（最多 14000 字符）建立词与汉字二元组特征集及倒排表。模型只给少量修正词与检索近义词；本地取命中的 posting lists，不把全量正文上传。特征权重由词/二元组类型和逆文档频率决定，得分是命中查询权重 / 查询总权重；完整短语命中提供加成。

分数超过宽松门槛才进入候选池；**排序不偷换成相似度排序**，而是继续使用 `ZGSpatial.compareAnswers`，也就是用户全局“最多赞 / 最新 / 随机”。默认最多截取 12 篇给模型复核。这里的 selectivity 记录为 matched / pool：比例越小，排除的文章越多。它是检索量指标，不是准确率或召回率。宽松门槛会放大候选池，最终预算限制保证不会无限发给 AI。

每篇候选只给两个原文切片：首个可用短句，以及另一条词面支持更强的句子；单句最多 130 字符，均必须在正文中直接找到。没有合适的第二句则用下一句或只有第一句，不编摘要。词面算法对同义表达仍可能漏召回，不等价于 embedding 检索。

## 请求/响应契约

第一次请求最多 80 个节点，每节点最多 2 条 95 字符支持句。响应形如 `{"repairs":[{"id":"k1","label":"预算规划","terms":["支出管理"],"reason":"支持句讨论预算而非网页属性"}]}`；最多 8 个，不创建节点，禁止重复 ID、碰撞标签、网页词、无意义短词。

第二次请求最多 8 组，每组默认 12（可调到 24）篇候选，每篇最多 2×130 字符。响应形如 `{"groups":[{"id":"k1","accepted":[{"id":"900001","snippet":0}]}]}`。snippet 是发给模型的原文数组索引，不接收生成式 quote。响应必须引用已提供候选，再按全局顺序截到每组至多 8 篇。不足 8 篇不补位，0 篇则不提交该词修正。

语法级 Schema 在 `schemas/ai-scan.schema.json`、`schemas/ai-selection.schema.json`。运行时不加载远程 Schema，也不引入通用 Schema 库；使用更严格的候选成员关系/原文子串/标签规则校验。JSON 模式是请求偏好，不能替代验证。关闭 JSON 模式也仍校验模型输出。

## 提交、失败与回退

扫描只是建议，不立即改图。第二阶段验证完成后才保存撤销快照、更新标签与证据邻接。节点 ID 不随改名变化；回答节点不删除、不复制，收藏通过 answerId/nodeId 保持引用。回答可参与多个主题的精选，但只有一个主父节点，其余是交叉关联。未选旧子节点按本地词面重归属；匹配不到回问题核心。

网络失败、超时、非 JSON、过大响应、token 截断、无候选、无证据时均不提交本轮建议。已生效的更早修正仍保留，可单独撤销最近一轮。本地星系不依赖 API 成功。取消/回答池更新/关闭星系会使迟到结果失效；更改供应商和顺序也取消待执行结果。缓存仅限当前星系会话、最多 8 份结果，指纹包括回答正文、标签、优先级、种子和配置版本，绝不缓存密钥到导出对象。

## 延迟、并发与隐私边界

单次请求默认 22 秒，5–25 秒可调；通常两次，扫描无需修正则一次，无隐式重试。一个来源一次在途，整个扩展最多两次在途、每分钟 12 次请求。候选索引每 12 篇让出一次事件循环。自动执行默认关闭，勾选后在回答池稳定 1.8 秒后尝试一次；用户仍可手动校对。

网络在 worker 发起，只使用用户保存、明确授权的 Base URL。设置页基于用户点击申请该域名权限；`optional_host_permissions` 中的 HTTPS 通配声明不等于安装时获得所有网站权限。云端 HTTPS、回环 HTTP，拒绝 URL 内用户名/密码/query/hash，拒绝跳转转发凭据，不附带页面 cookie。会话密钥在 `chrome.storage.session`；选择长期记住时用扩展来源 IndexedDB，不回传到内容脚本。不提供客户端加密保险箱保证。

不会自动附加作者、来源 URL、票数、时间、轨迹、收藏状态、笔记或画像给模型；用户偏好通过候选顺序体现。原文数据中可能包含个人信息或提示注入，只能通过授权、限制输入、禁工具、验证输出来降低风险，不能承诺模型永不误判。多用户上线前应换成带用户授权、额度隔离与审计的后端代理，不分发组织密钥。

## 供应商维护依据

实现前对照官方接口说明；模型 ID/地域/账户权限可能变化，应以用户控制台为准。资料查阅日 2026-09-10：

- Chrome optional permissions: https://developer.chrome.com/docs/extensions/reference/api/permissions
- Chrome storage / session: https://developer.chrome.com/docs/extensions/reference/api/storage
- OpenAI Chat Completions: https://platform.openai.com/docs/api-reference/chat/create
- DeepSeek: https://api-docs.deepseek.com/
- 百炼 OpenAI 兼容与地域端点: https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope

上述链接是接口维护入口，不表示本包已经使用付费真实密钥测试过所有供应商。内置连接测试无知乎正文，但仍是计费请求；错误状态有安全说明，不向知乎文档返回供应商原始错误体。
