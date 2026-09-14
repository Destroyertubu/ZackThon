# 知乎收藏内容填充 · 2026-09-14

本批通过现有知乎 API 搜索服务取得 5 组、共 50 条真实结果，人工选择 30 条作为收藏树的初始材料：文学、摄影、哲思、自然、音乐各 6 条。检索缓存保留全部 50 条，个人收藏包仅包含选中的 30 条。

首次实施通过个人空间 UI 完成了以下三个浏览器的导入与核验。这只能覆盖当时的三个存档；新浏览器或其他访问地址仍会出现空树。

现已补上应用初始化：`src/features/personal/data/zhihu-starter-v1.json` 随前端提供同一批 30 条公开来源和收藏记录。读取旧个人空间、完成迁移后，`applyCollectionSeed()` 合并精选，再将收藏与 `collectionSeedVersions` 批次标记一起写入 IndexedDB，读回验证后才开放观星台和星系。这一步不调用知乎 API，也不向服务器发送个人资料。

- 相同来源已有收藏时保留个人摘录，不再添加重复来源；个人笔记、作品、设置、旅程和返回点不变。
- 刷新不重复添加。删除一条或删空后，批次标记仍然保留，内容不会自动复活。
- 对先前已手工导入的存档，使用相同记录 ID 或完整来源集识别历史导入，只补标记，保留已经做过的删除。
- JSON 导入导出保留批次标记。存储写入失败时显示临时存储提示，原磁盘存档保留。
- 每个浏览器／网址仍拥有独立的个人空间；新增笔记和收藏不跨浏览器同步。各入口能够取得同一批初始公开精选。

以下为首次手工导入的基线记录：

| 已验证浏览器 | 收藏 | 保留的原有旅程 | 笔记 | 作品 |
|---|---:|---:|---:|---:|
| 普通公网浏览器 | 30 | 3 | 0 | 0 |
| 本地 `http://127.0.0.1:4187` 浏览器 | 30 | 5 | 0 | 0 |
| RTX 内的 Firefox | 30 | 1 | 0 | 0 |

公网再次导入同一包后仍为 30 条收藏。收藏树已验证每枝按 4 + 2 分页；自然组来源阅读显示作者 Joe Chen、非全文标识及对应原始来源链接。RTX 导入截图 `rtx-import.png` 显示“已合并个人空间，原有数据已自动备份”。

## 内容与筛选边界

- 取得的是 API 搜索摘要或截取文本，不是全文。收藏包每项最多保留前 600 个 Unicode 字符；超出时附“搜索摘要节选，完整内容见原文”。摘要同时作为收藏摘录，树与静读页按来源摘要显示。
- 标题、作者、原文 URL、来源类型和获取时间保留。摄影组 6 条的作者字段均为 API 返回的“作者未提供”，没有从正文推测补写。
- 回答与文章分别保留 contentType；只有实际存在问题编号的回答才附加问题—回答关系。不同 URL 表达的同一知乎回答归到同一个 canonical source ID。
- 选材兼顾主题相关性、内容实质及来源多样性，排除了课程销售导流、明显年代错误和无出处的精确神经化学数字。保留的哲思、心理及音乐解读仍是作者观点，不视为已经核验的学术或临床结论。
- 音乐组有同一问题下的两位作者，分别提供情绪命名和共鸣的讨论；其余四条来自独立问题或文章。摄影部分内容依赖图片，需通过原文入口看图。

## 文件与复现

- 生成脚本：[scripts/prepare-zhihu-collection.ts](../../scripts/prepare-zhihu-collection.ts)。只读取已抓取快照，不发起 API 请求。
- 公共缓存迁移脚本：[scripts/import-zhihu-search-cache.ts](../../scripts/import-zhihu-search-cache.ts)。验证包内均为有效知乎 HTTPS 搜索摘要后，先通过 Node SQLite backup API 备份到 `<database>.before-seed-<timestamp>.sqlite3`，再按规范化查询键写入缓存；已存在同样新或更新的缓存会跳过。它只导入公共检索快照及来源目录，不写浏览器个人收藏、不迁移认证信息，也不发起上游请求或增加上游调用预算。
- 导入包：[zhihu-collection.personal.json](../../artifacts/zhihu-collection-20260914/zhihu-collection.personal.json)。
- 来源清单：[manifest.json](../../artifacts/zhihu-collection-20260914/manifest.json)；人工选择与理由：[selection.json](../../artifacts/zhihu-collection-20260914/selection.json)。
- 公共缓存包：[public-search-cache.json](../../artifacts/zhihu-collection-20260914/public-search-cache.json)；重复读取结果：[cache-verification.json](../../artifacts/zhihu-collection-20260914/cache-verification.json)。五组复查均返回 cached=true、各 10 条；迁移至 RTX SQLite 后，五组公开查询也已全部验证 cached=true。
- 原始 API 返回保存在同目录的 literature.raw.json、photography.raw.json、philosophy.raw.json、nature.raw.json、music.raw.json。
- manifest 的 importedAt 为包生成时间 `2026-09-14T03:57:31.389Z`，不等于每个浏览器实际导入时间；各来源 fetchedAt 保留其 API 获取时间。

```sh
npx tsx --tsconfig tsconfig.app.json scripts/prepare-zhihu-collection.ts
```

导入使用现有个人空间合并入口，先备份当前数据，再写入新 profile。收藏记录使用来源身份生成的固定 ID；同一包重复导入不会产生新的记录 ID。独立笔记、作品、旅程和个人设置保留。若其他收藏本来使用不同记录 ID 保存了同一来源，仍需检查重复摘录，不能仅凭来源 URL 判断是可删除的重复记录。

## 浏览器与访问地址

个人空间使用浏览器 IndexedDB，绑定浏览器配置和 origin（协议、主机、端口）。普通公网地址、localhost/127.0.0.1 和 RTX 内的 Firefox 不共享收藏存储；公网隧道更换域名也会形成不同 origin。需要在目标浏览器通过“小屋 → 我的收藏 → 导入”使用同一包迁移。公开 SQLite 检索缓存可由服务器复用，但不会把某个玩家的收藏自动分发给其他访客。

## 本批收藏清单

### 文学 · 6 条

检索词：`文学 阅读 生活意义`

- [你读过的每一本书,都在悄悄拓宽你的人生|夜读 - 知乎](https://zhuanlan.zhihu.com/p/2077909290472555430) — 北京大学出版社
- [我们在读文学的时候,究竟要从文学里获得什么? - 知乎](https://www.zhihu.com/question/367645873/answer/2034860315033212858) — 驿路杨尘
- [文学究竟能给普通人带来什么? - 知乎](https://www.zhihu.com/question/2055183860036527704/answer/2077054928485466415) — 岁阅春秋
- [我读过很多书,但后来大部分都被我忘记了,那阅读的意义是什么? - 知乎](https://www.zhihu.com/question/1976120753834443272/answer/2079704216646465294) — 提拉米苏
- [你喜欢文学吗,为什么? - 知乎](https://www.zhihu.com/question/1904470546755883299/answer/2047270566932042031) — 风雪夜归人
- [今天为何仍需文学?这是我看过最好的答案 - 知乎](https://zhuanlan.zhihu.com/p/1929116251386545009) — 北京大学出版社

### 摄影 · 6 条

检索词：`摄影 光影 构图`

- [摄影小白,必学的光影法则 - 知乎](https://zhuanlan.zhihu.com/p/2040489925951365649) — 作者未提供
- [摄影技巧 | 如何把控光影、构图,才能拍的风景如画? - 知乎](https://zhuanlan.zhihu.com/p/1991057344185013486) — 作者未提供
- [摄影光影运用技巧,让照片瞬间生动起来 - 知乎](https://zhuanlan.zhihu.com/p/2074451028704080051) — 作者未提供
- [摄影中拍摄不同的内容,构图有什么技巧? - 知乎](https://www.zhihu.com/question/627278063/answer/3617669093) — 作者未提供
- [​摄影构图的核心技巧是什么? - 知乎](https://www.zhihu.com/question/634093084/answer/3323860417) — 作者未提供
- [什么样的构图才是好构图? - 知乎](https://www.zhihu.com/question/21997097/answer/2048515839717021094) — 作者未提供

### 哲思 · 6 条

检索词：`哲学 自我 认识`

- [哲学算是自我认识和反思吗? - 知乎](https://www.zhihu.com/question/1896127815532904974/answer/1907802919669076143) — 法思者
- [认识你自己——苏格拉底哲学 - 知乎](https://zhuanlan.zhihu.com/p/139508691) — 李青白
- [黑格尔思想中的「自我」是如何理解的? - 知乎](https://www.zhihu.com/question/1920863357579294004/answer/1923361117704525513) — 江南弦
- [哲学三大主题:解释世界、理解生命、认识自己 - 知乎](https://zhuanlan.zhihu.com/p/672133410) — 百里相泽
- [读《哲学科学全书纲要》-第三部分 精神哲学-第一篇 主观精神-B.精神现象学 意识-自我意识-概述-424-425(116) - 知乎](https://zhuanlan.zhihu.com/p/550095817) — 纯思
- [奥伊泽尔曼《哲学的自我界定、自我认识和自决》 - 知乎](https://zhuanlan.zhihu.com/p/2043086019327681374) — 45ddth

### 自然 · 6 条

检索词：`自然 植物 森林`

- [北方森林树种变多,是因为全球变暖? | 科技前线 - 知乎](https://zhuanlan.zhihu.com/p/731410837) — 中科院之声
- [微气候 “主宰” 林下植物多样性 | 前沿 - 知乎](https://zhuanlan.zhihu.com/p/142723019) — 知识分子
- [世界野生动植物日 | 森林的未来 我们的未来 - 知乎](https://zhuanlan.zhihu.com/p/354237016) — WWF世界自然基金会
- [为森林发声|森林和生物多样性——无比珍贵,不容丧失 - 知乎](https://zhuanlan.zhihu.com/p/121782148) — WWF世界自然基金会
- [世界森林类型有哪些及其特征是什么? - 知乎](https://www.zhihu.com/question/297299084/answer/2434145766) — Joe Chen
- [国内有哪些原始森林适合旅行? - 知乎](https://www.zhihu.com/question/493092346/answer/2179832881) — 明宇

### 音乐 · 6 条

检索词：`音乐 情绪 聆听`

- [怎样才能在音乐中听出感情? - 知乎](https://www.zhihu.com/question/345059736/answer/821415889) — 王蕴藉
- [纯音乐欣赏:感知点滴乐思,释放自我情感 - 知乎](https://zhuanlan.zhihu.com/p/20837657) — 孟章
- [一个音乐学博士的思考——“形式自律论”的另一面?朗格告诉我们,音乐是“情感的形式” - 知乎](https://zhuanlan.zhihu.com/p/2035512701011675064) — 炫佑skr
- [抖音快手的背景音乐如何影响你我的情绪 - 知乎](https://zhuanlan.zhihu.com/p/662337088) — 小螺母
- [为什么有时候听悲伤的音乐也能让人感到「舒服」?这是一种替代性宣泄吗? - 知乎](https://www.zhihu.com/question/13321437232/answer/110342576323) — 解磊
- [为什么有时候听悲伤的音乐也能让人感到「舒服」?这是一种替代性宣泄吗? - 知乎](https://www.zhihu.com/question/13321437232/answer/115908408897) — 心理这点事儿
