# 星树花园与 Wanderwise 星系

本轮整合来源为 [Wood3307/Wanderwise](https://github.com/Wood3307/Wanderwise) `main`，锁定提交 [`43094bdf13282e963baa80510f7bf6de074b2af8`](https://github.com/Wood3307/Wanderwise/commit/43094bdf13282e963baa80510f7bf6de074b2af8)，上游称为“星空 7.1”。克隆位于本项目旁的 `Wanderwise-upstream-20260914`；运行不依赖该目录。此前整合基线为 `229e4bd1a9623fa6a10f53387f31259434823976`。

本文记录本轮整合范围和宿主契约，验证命令是验收要求，不表示本轮测试、浏览器验收或部署已经完成。

## v7.1 整合范围

- 搜索转场：旧星系解离成星尘并被黑洞吸入，新结果以闪光、光环与星尘出现；请求与动画并行，连续搜索只接受最新结果。减少动态效果时直接切换。
- 星系与彗星：扩大宏观间距，移除星系间装饰连线，保留文字与天体的短引导线；第三层彗星沿恒星系外围间歇经过。
- 阅读：增加朱雀仿宋与字号调整，加入 Markdown/LaTeX 排版和从实际字形采样的星尘。选段、收藏与思考继续引用原始文本，不能保存排版后的 HTML 或把公式截成错误片段。上游 7.1 提交说明明确标记 Markdown 修复仍未完成，本项目不据此宣称所有语法均已完整支持。
- 背景音乐：沿用上游《Day One》音源与播放控件，资源迁入 `/galaxy/audio/`。必须服从主项目静音偏好，浏览器阻止播放时显示等待交互状态；不能把“已开启”误报为“正在播放”。音源说明见[第三方记录](galaxy-third-party-notices.md)。

集成继续遵守主项目的减动效、静音和阅读交互规则。阅读、输入或弹层打开时暂停自动运动，保留静态阅读及必要手动导航；不因载入上游的默认音乐设置而解除玩家已选择的静音。

## 本地启动

当前内容服务使用 Node 24 的 SQLite 能力。首次安装使用 `npm install`，构建后运行：

```sh
npm run build
npm start
```

统一入口为 `http://127.0.0.1:4187/observatory`。同一进程提供小屋、观星台、`/galaxy` 页面和 `/api/*` 内容接口。`npm run preview` 也启动该进程；单独使用 Vite preview 不会提供内容 API。

开发使用 `npm run dev`：前端 `http://127.0.0.1:4173`、API `127.0.0.1:4188`，Vite 转发 `/api`。生产端口可通过 `PORT` 设置，监听地址通过 `HOST` 设置。沿用现有本地及 RTX 服务和隧道，不需要另起一套上游服务器。

## 进入、阅读与返回

观星台星门、靠近后的 E 交互与“进入星系”进入 `/galaxy`，不要求旧词云世界的 seed。空检索使用真实公开作品快照；输入问题后使用宿主内容服务。

星系保留问题/主题 → 回答/作品 → 段落三级探索，以及阅读、收藏、思考、足迹和 Markdown 导出。`src/features/galaxy/index.tsx` 是宿主路由包装：

- `location.state.wanderwiseEntry` 确认可使用当前个人空间的 `returnAnchor`；直接访问 `/galaxy` 不套用过时旅程锚点，默认返回观星台。
- 从旅程进入时，`entrySources` 提供本次已选择的真实来源，初始展示来源摘要或阅读导引；玩家仍可发起新的知乎搜索。
- `returnLabel` 显示实际目的地；返回按钮或 H 触发可取消的 `wanderwise:return`，由 React Router 接管。
- 返回旅程时恢复相同 `journeyId`、`stationId` 和 `pose`，继续使用 `/journey/:realmId?trip=...`；普通入口返回 `/observatory` 或已登记的陆地位置。
- 搜索更新 URL 时保留 `window.history.state`，不丢失宿主路由键与进入状态；输入、IME、阅读和弹层期间不得被返回快捷键打断。

2026-09-14 已按要求移除首页“生成我的世界”与旧词云场景。`/` 直接进入 `/home`，旧 `/world` 链接以 replace 方式转到 `/land`；旧收藏、笔记和历史记录继续保留。星系按路由懒加载，使用宿主 React/Three，不创建第二个 React root，也不在观星台 Canvas 内再嵌套星系渲染器。

## 内容与共享存储

所有请求使用同源接口：`/api/health`、`/api/explore`、`/api/questions/:id`、`/api/knowledge/:workId`、`/api/answers/:id/highlights`。现有 Express 服务继续负责官方 CLI、公共 SQLite 缓存、每日预算和错误反馈，不因更新前端替换成上游独立后端。认证只留在服务端，不使用 `VITE_` 前缀或放入浏览器 URL。

`Question.kind` 区分真实问题、独立文章与主题聚合；搜索摘要、项目导引和官方正文节选分别标识。缺失作者保留“作者未提供”，失败或无结果时不补造帖子。精华必须是其来源段落中的真实子串；来源变化后旧精华失效。

`wanderwise-personal` IndexedDB 中的共享个人空间是收藏与笔记的权威来源，小屋、收藏树、陆地与星系读取同一套来源身份。`personal/galaxyBridge.ts` 将它投影为上游界面可用的结构：

- `wanderwise.collection.v1`、`wanderwise.reflections.v1`、`wanderwise.journey.v1` 保留为旧版兼容与备份键，不再是三个独立的主存档。
- 同一来源可以有多个独立摘录；在星系原样读写列表必须保留这些摘录。取消收藏不删除独立笔记。
- 星系可见收藏与笔记最多 500 条；保存函数接收完整可见列表，不能用某页、搜索筛选结果或启动时的空列表替代，否则会误触发删除。未投影的笔记须保留。
- 真实来源的 canonical URL、remoteId、发布者、精选标识与问题归属保留；独立文章不能被伪装成问题回答。
- `wanderwise-game-v1`、旧配方及个人材料继续由现有迁移/桥接逻辑维护，本轮不更名、不清空，也不新增另一个“星系收藏库”。

现有 30 条知乎初始收藏属于已导入的目标浏览器，详见[填充记录](design/zhihu-collection-20260914.md)。更换域名、端口或浏览器配置不会自动同步个人存档；公共检索缓存与个人收藏是不同数据。

## 样式、资源与生命周期

样式限定在 `.galaxy-page`，动画使用 `ww-galaxy-` 前缀。字体 family 为 `Wanderwise Galaxy Sans`、`Wanderwise Galaxy CJK` 和新增 `Wanderwise Galaxy Fangsong`；朱雀仿宋完整字体、首屏子集和 OFL 许可放在 `/galaxy/fonts/`，不更改小屋的全局字体。

背景、音频及字体均从本项目资源路径加载。公式排版使用包内数学字体，不引入外部 CDN。星系路由卸载时释放自己的 WebGLRenderer、动画帧、监听器和 GPU 资源，并停止音频；场景内部布局重建不应对复用中的画布调用 forceContextLoss。

## 验收入口

```sh
npm run test:personal
npm run test:content
npm run test:galaxy
npm run test:galaxy-connection
node src/features/galaxy/tools/run-tests.mjs
node src/features/galaxy/tools/verify-styles.mjs
npm run test:home
npm run test:observatory
npm run test:look
npm run test:garden
npm run build
```

自动测试使用固定内容与隔离存储，不需要真实搜索或模型凭据。浏览器还需核验：旧收藏/笔记与旅程往返、连续搜索失败与重试、公式原文选段、减动效、主项目静音、音乐播放被阻止的反馈、触屏和连续路由切换后的资源释放。最终通过项与部署状态应以实际验收记录为准。

源码适配见 [UPSTREAM.md](../src/features/galaxy/UPSTREAM.md)，第三方说明见 [galaxy-third-party-notices.md](galaxy-third-party-notices.md)。

## 2026-09-14 适配验收

已将 `43094bdf13282e963baa80510f7bf6de074b2af8` 发布到本地与 RTX 服务，保留原有公网隧道。版本信息可读取 `/galaxy/upstream-version.json`。

- 标准星系测试 116/116，宿主集成测试 10 组通过；TypeScript、定向 ESLint 与 635 个样式选择器隔离检查通过。
- 浏览器检查了三层展开、缓存搜索的黑洞转场、摘要阅读和返回观星台；390×844 下搜索、返回和音乐入口可见。
- 普通公网升级后收藏树与星系行囊均仍为 30 条；本地及 RTX 的五主题公共搜索缓存保持不变。
- 共享文字动效不再静态引入 Markdown/KaTeX；公式渲染留在星系懒加载模块内。
- 测试与发布记录位于 `artifacts/galaxy-v71-integration/`；本地旧版保存在其 `baseline/`，RTX 旧版位于 `artifacts/galaxy-v71-backup/`。生产保留上版哈希资源，已打开页面的后续模块请求不会因更新立即失效。
- 历史缓存已丢失的排版不会被重建；未自动清缓存或追加上游搜索。本轮没有重新作完整 GPU 帧率基准。
