# 镜海群岛：实现与本地运维说明

记录日期：2026-09-13。项目目录：`/Users/gauss/Desktop/Kimi_Agent_小屋真实感建模/app`。本文件根据当前源文件、素材报告与本轮验收记录整理；旧版 [星系接入说明](galaxy-integration.md) 中关于独立收藏存储、浏览器密钥与模型接入的描述，现以本文件和 [内容服务说明](../server/content/README.md) 为准。

当前交付是十种酒境均可进入、阅读、创作并带回收获的完整可玩首版。镜海陆地、小屋阅读角、刘看山、调酒出发、共享个人空间与星系往返已接通。视觉仍未达到概念图的电影级一比一效果；首帧编译、真实移动设备性能与进一步的布景精修仍有改进空间。

## 1. 入口与空间分工

| 空间 | 路由 | 已实现的主要用途 |
| --- | --- | --- |
| 小屋 | `/home` | 整理兴趣、收藏、笔记、作品、配方与旅程；在合成台组织想法；与刘看山互动 |
| 观星台 | `/observatory` | 调酒、查看近期话题、进入星系，并通过归家门返回小屋阳台 |
| 镜海群岛 | `/land` | 花林分岔、镜湖对照、山径深入与海岸出发；将材料带入星系 |
| 酒境 | `/journey/:realmId?trip=:journeyId` | 在五个停靠点阅读和完成该世界的专属活动，保存作品并继续原旅程 |
| 星系 | `/galaxy` | 展开问题、回答、公开知识作品与来源；阅读、收藏、记录思考，并返回来处 |

原 `/world`、`/canvas` 页面和旧游戏业务状态保留。生产 Express 服务直接支持这些页面，以及 `/land`、`/journey/:realmId` 的刷新与地址栏访问。

陆地主区域以约 60×60 米的近景可行走表面、碰撞、木桥与高差组织路线；远处镜海、岛屿和群山使用分层背景。小屋外景与观星台复用镜海背景构件，近景沿用木材、黄铜与植物材质。这里的山、湖、森林和海岸分别对应循序深入、观点比较、分岔探索与跨领域出发。

## 2. 十杯酒与十种活动

世界定义在 [realmDefinitions.ts](../src/features/journeys/realmDefinitions.ts)，活动及精选材料分配在 [content.ts](../src/features/journeys/content.ts)。五种原料的无序组合决定世界，调换原料顺序不改变目的地。比例调整材料顺序与少量照明色彩，不生成另一套几何。

| 酒名与配方 | 稳定路由 ID | 空间与活动 | 可带回的成果 |
| --- | --- | --- | --- |
| 落日大道 · 文学 × 摄影 | `sunset-boulevard` | 落日水岸长街、画廊与书窗；拍摄、排序、补写画外故事 | 我的落日三联画 |
| 未寄出的答案 · 文学 × 哲思 | `unsent-answers` | 海上时差邮局与分岔连桥；分别从昨天与明天回信 | 写给两个时间的信 |
| 苔藓来信 · 文学 × 自然 | `moss-letters` | 巨树信林、树根与苔藓；区分观察与植物视角的想象 | 一株植物的来信 |
| 月光行板 · 文学 × 音乐 | `moonlight-andante` | 月下水上舞台；用节拍、长短句与休止组织文字 | 夜归的文字乐谱 |
| 镜外之问 · 摄影 × 哲思 | `beyond-the-frame` | 镜池与取景回廊；比较窄框、宽框与相反解释 | 画面内外的两种解释 |
| 露光标本 · 摄影 × 自然 | `dew-specimens` | 叶脉高架、露珠与微观花园；记录三种尺度 | 三种尺度的露光标本 |
| 蓝调快门 · 摄影 × 音乐 | `blue-hour-shutter` | 雨夜街巷、转角和橱窗；编排影像与节奏 | 雨夜影像节奏 |
| 树的时间 · 哲思 × 自然 | `tree-time` | 巨树、年轮路与四季停靠点；比较改变、延续与反例 | 年轮与反例 |
| 回声悖论 · 哲思 × 音乐 | `echo-paradox` | 静水共鸣殿堂；逐次改变四音动机并提出同一性标准 | 关于同一段旋律的判断 |
| 林间慢拍 · 自然 × 音乐 | `forest-lento` | 湿地、芦苇与木栈道；安排叶、水和脚步的八拍声景 | 八拍森林序曲 |

每个世界有五处停靠点、五步创作提示和六份不同的可追溯精选材料。六份材料由当前共 17 条公开来源按领域和世界分配，不应表述为 60 篇互不重复的文章。标题、作者、链接、摘要和导读见 [curatedSources.json](../src/features/journeys/curatedSources.json)。画廊中另有标明作者及博物馆链接的公共领域作品，它们是精选布景，不是玩家收藏或玩家原创。

调酒按钮先展开杯中风景并预加载页面，然后自动创建独立旅程实例和跳转；重复点击锁定，取消或关闭会使当前出发尝试失效，加载失败可重试。配方册可以再次出发，每次旅程保留自己的进度、材料与作品。照片来自当前 Three.js 相机的实际截图，保存在旅程草稿中；作品文本保留活动说明与文字记录，不把图片数据编码写成正文。声音活动使用原创合成提示和可见节拍，静音时仍可完成。

## 3. 个人数据、共享收藏与返回位置

类型契约在 [personal/types.ts](../src/features/personal/types.ts)：`RealmDefinition` 定义世界，`JourneyInstance` 表示一次出发，`JourneyProgress` 保存足迹、草稿和视角，`SceneReturnAnchor` 保存返回页面、旅程、停靠点、来源与相机位置。

个人空间使用浏览器 IndexedDB 数据库 `wanderwise-personal`、对象仓库 `vault`，当前档案键为 `profile`。收藏、笔记、作品、兴趣、配方、旅程进度、视角和伙伴设置都由 [personal/store.ts](../src/features/personal/store.ts) 统一读写。小屋、陆地、观星台与星系接入同一档案，个人数据不写入公共 SQLite 内容缓存。

来源用规范 URL 建立身份，保留原文 URL 和服务端 `remoteId`。确定属于知乎主站的 `/answer/456` 与 `/question/123/answer/456` 归为同一个回答；外部网站、专栏文章、相似域名不会被误并为知乎回答。只接受无用户名密码的 HTTP/HTTPS 链接。收藏记录与来源分离，因此同一来源的多个摘录会分别保留；取消收藏不会删除独立笔记。星系适配器保留已有作者、出处、精选身份和摘录，不把外部精选材料改标为知乎摘要。

旧键 `wanderwise-game-v1`、`wanderwise.collection.v1`、`wanderwise.reflections.v1`、`wanderwise.journey.v1`、`wanderwise-garden-recipes-v1` 的迁移可重复执行：先保存 `legacy-backup-v1` 原始备份，再写入新档案并读回校验，最后才标记迁移完成。来源别名归一前另写备份；导入旧 v1 档案会同步重映射收藏、笔记、作品、旅程和返回锚点的来源引用，保留各摘录与旧 ID。

旧游戏的 seed、nodes、visitedWords、trail、backpack、links、anchors、journeys 八类业务字段及画质经过形状校验恢复。普通收藏操作不会重置旧世界；背包投影保留旧记录 ID 和有效 links 引用，删除对应背包项后清除失去端点的 links，原始内容仍在迁移备份中。相关实现见 [legacyBridge.ts](../src/features/personal/legacyBridge.ts) 与 [galaxyBridge.ts](../src/features/personal/galaxyBridge.ts)。

个人空间提供 JSON 导入/导出。写入失败时保留内存中的已读数据与本次修改，并展示保存异常，不把失败标为迁移成功。IndexedDB 属于浏览器与站点来源：本地 HTTP、公网 HTTPS、另一浏览器或另一台设备的档案互不自动同步。切换入口或隧道域名之前，可通过导出/导入转移自己的档案。

从旅程进入星系前记录当前实例、停靠点、来源及视角，星系返回按钮使用来处名称，返回同一实例和位置；陆地与观星台也保存各自的返回锚点。直接打开星系时默认返回观星台，不采用无关的旧锚点。星系支持可见返回按钮及 H 快捷键；文字输入时不触发移动或返回快捷键。刷新与浏览器历史通过实例 URL 和持久进度继续，非法或已不可达的相机位置回到该世界入口。

## 4. 知乎内容服务与 AI

后端沿用一个 Express 进程，使用 Node 24 的 `node:sqlite`，无额外数据库服务。官方 CLI 通过 `execFile` 的固定命令和独立参数数组调用，`shell:false`。本机默认 CLI 路径为 `/Users/gauss/Library/Application Support/zhihu-cli/current/zhihu-cli`，认证继续由官方 CLI 从钥匙串读取。设置页仅显示服务连接和配置状态，不再要求玩家输入上游密钥。

| 接口 | 用途与边界 |
| --- | --- |
| `GET /api/health` | 服务与配置状态；不返回凭据，配置存在不等于每次上游请求都成功 |
| `GET /api/search?q=…&provider=zhihu\|global` | 知乎或全网搜索；默认使用本地持久缓存 |
| `GET /api/hot` | 热榜摘要；不自动轮询刷新 |
| `GET /api/explore?q=…` | 保持星系探索响应契约，内部使用统一内容服务 |
| `GET /api/questions/:questionId?q=…` | 获取本次探索中真实问题的回答，保持问题归属 |
| `GET /api/answers/:answerId/highlights` | 公共阅读中的确定性摘要精华，不消耗 AI 预算 |
| `GET /api/knowledge/:workId` | 保留原公开知识作品阅读入口 |
| `POST /api/access` | 提交访问码，换取两小时 HttpOnly、SameSite 会话 |
| `POST /api/synthesis` | `idea` 组织想法；`journey` 组织既有世界中的阅读导引；需要访问码会话 |

统一检索响应为 `items`、`cached`、`fetchedAt` 和可选 `notice`；条目保留来源类型、标题、作者、摘要、链接与获取时间。搜索、问题回答列表和热榜给出的摘要明确标注为摘要。只有实际取得正文的公开知识来源进入正文流程；文章、问题与知识作品不伪造“问题—回答”关系。上游失败如实显示，已有内容仍可阅读，不生成假帖子填充。

### 持久缓存与预算

默认服务数据目录为 `artifacts/content-service`，其中 `content.sqlite3` 保存公开摘要、来源快照、调用预算和单向哈希会话。缓存没有随页面刷新自动失效的时间规则；只有显式 `refresh=true` 才重新调用上游。相同在途检索合并，重复访问及服务重启复用缓存。旧漫知录 `data/zhiye.sqlite3` 已迁入 13 组可验证的公共搜索缓存，仅查询旧 `cache` 表，原数据库未修改，未读取私人业务表。

| 配置项 | 默认值 | 计数方式 |
| --- | --- | --- |
| `CONTENT_DAILY_GLOBAL` | 200 | 全站每日实时检索尝试 |
| `CONTENT_DAILY_VISITOR` | 20 | 每个已签名浏览器访客每日实时检索尝试 |
| `AI_DAILY_GLOBAL` | 50 | 全站每日 AI 合成尝试 |
| `AI_DAILY_CODE` | 10 | 每个访问码每日 AI 合成尝试 |
| AI 同时执行数 | 2 | 超出并发上限立即反馈忙碌 |

以上是应用上限，不是知乎官方额度。预算按 UTC 日期归档（北京时间 08:00 换日），SQLite 事务在请求上游前同时预留访客/访问码与全站预算，重启不会重置。缓存命中不占新调用预算；已发出的上游失败仍按一次尝试计数，忙碌拒绝不扣 AI 额度。上游额度或鉴权限制另行如实反馈。其余可配置项为 `CONTENT_DATA_DIR`、`ZHIHU_CLI_PATH` 与用于一次性旧公共缓存迁移的 `LEGACY_ZHIHU_DB`。

### 访问码与个人材料

访问码仅保存在被 Git 忽略的本地文件 [artifacts/content-service/.env.access.local](../artifacts/content-service/.env.access.local)，文件权限为 0600；该文件实际是 JSON，不是供 shell 执行的脚本。本说明不读取或展示码值。由项目所有者在本机查看并单独提供给需要 AI 的玩家，玩家在小屋“思维合成台”解锁。应用不会因请求来自 loopback 或 Cloudflare 转发就判定访客是主人。生产仅提供构建目录；Vite 开发服务显式拒绝访问服务源码、artifacts 与本地配置文件。

AI 接收玩家问题、最多八份服务端已有的真实来源 ID，以及玩家主动选入的个人文本；个人材料上限为 8000 字，问题上限 2000 字。服务校验生成结果中的来源 ID 和链接，拒绝未知来源；提示要求仅依据提供材料、区分摘要与全文。草稿需玩家编辑或采纳才成为个人作品，不写入公共共享缓存。无访问码仍可阅读精选内容、使用已有公共缓存、完成十种活动及手工创作。

小屋电话亭保留明确标识的本地故事角色对话。可选 AI 入口同样调用 `/api/synthesis`，只发送玩家当前输入的问题，不自动发送 NPC 历史，不加入无关固定来源；显示可编辑草稿及真实错误，访问码在合成台解锁。电话亭对话和临时草稿只存在本次面板状态，关闭后不会作为个人作品保存；正式作品由合成台明确采纳。没有公开 `me`、本人创作、关注或私人收藏接口；多人实时互动、知乎账号同步、OAuth 和任意生成 3D 世界不在本轮范围。

## 5. 刘看山与素材

| 交付物 | 文件 |
| --- | --- |
| 运行时立体模型 | [liukanshan.glb](../public/models/liukanshan/liukanshan.glb) |
| 可编辑 Blender 源文件 | [liukanshan.blend](../assets/source/liukanshan/liukanshan.blend) |
| 动作及组件 | [mascot/](../src/components/home/mascot/) |
| 模型尺寸、节点和来源记录 | [README](../public/models/liukanshan/README.md)、[asset-report.json](../public/models/liukanshan/asset-report.json) |
| 重建脚本与多角度验收图 | [build-liukanshan.py](../scripts/build-liukanshan.py)、[renders/](../assets/source/liukanshan/renders/) |

模型依据用户提供的《看山三视图.zip》《刘看山动态.zip》独立重建，运行时具有真实体积、PBR 材质和阴影，不是透明 GIF 面片。高约 0.823 米，48,589 三角面，GLB 为 1,306,120 字节，16 个网格包含立体电脑。小屋阅读角摆位为 `[-2.95, 0.17, -3.2]`，配合原通行路线和实体底座。

角色包含待机、入屋迎接、检索用电脑、阅读打盹、收藏回应五种运行状态。动作由命名关节程序驱动，GLB 不内嵌动画片段。靠近 E 打开个人内容入口，可关闭动作和提示。原版六段 GIF 作为参考保留，不应宣称运行时完整复现了六段官方动画。

刘看山角色及参考素材的权利属于原权利人；它们是用户提供的官方角色参考，**不是 CC0 或开源授权素材**，此模型也不是官方发布的 3D 模型。

环境主要复用 Poly Haven 的 CC0 木材、石材、Jacaranda 树与植物，ambientCG 的 CC0 常春藤，以及有来源记录的 NASA 装饰星图。新画廊使用美国国家美术馆标为公共领域的莫奈、透纳作品，并提供馆藏出处。素材清单和加工边界见：

- [酒境素材与画廊作品来源](../src/features/journeys/scene/assets/SOURCES.md)
- [酒境共享 WebP 纹理与大树优化](../public/models/garden/journey-textures/README.md)
- [Jacaranda 原模型、许可与本地 Draco 解码器](../public/models/garden/JACARANDA.md)
- [观星台植物素材记录](../public/models/garden/README.md)
- [星系上游与第三方声明](galaxy-third-party-notices.md)

酒境大树保留 438,168 三角面、所有叶片岛与原几何/UV，使用 6,627,960 字节的独立优化 GLB；近看树皮的贴图微细节低于观星台原树版本。纹理、模型与 Draco 解码器均从项目本地提供。

## 6. 运行、公网访问与备份

使用 Node.js 24。首次安装依赖后，从项目目录构建并启动生产服务：

```sh
cd '/Users/gauss/Desktop/Kimi_Agent_小屋真实感建模/app'
npm ci
npm run build
npm start
```

日常已经安装依赖时无需重复 `npm ci`。`npm start` 默认监听 `127.0.0.1:4187`，同时提供 `dist` 与 `/api/*`；`npm run preview` 指向相同 Express 入口。可用 `HOST`、`PORT` 调整监听配置。替换已运行版本时先构建完成，再停止原应用进程并启动新进程，避免两个进程抢占 4187；无需为普通代码更新重启现有隧道。

- 本地小屋：[http://127.0.0.1:4187/home](http://127.0.0.1:4187/home)
- 本地观星台：[http://127.0.0.1:4187/observatory](http://127.0.0.1:4187/observatory)
- 本轮沿用的公网入口：[https://resume-chan-cooperation-delete.trycloudflare.com](https://resume-chan-cooperation-delete.trycloudflare.com)

公网入口由既有 Cloudflare 临时隧道转发到本机 4187，不是独立云端副本。本机应用和隧道需要持续运行，电脑休眠或进程退出会中断访问。若原隧道已经失效，可重新运行以下命令并以它实际输出的域名为准；重新创建的临时隧道不能保证保留上面的旧域名：

```sh
cloudflared tunnel --url http://127.0.0.1:4187
```

开发使用 `npm run dev`：Vite 在 `127.0.0.1:4173`，API 在 `127.0.0.1:4188`，Vite 代理 `/api` 并保留同源 Host。仅运行 Vite 静态预览不足以提供检索和 AI 接口。部署文件不仅需要 `dist`，还需要 `server`、运行依赖、公开来源清单、公开知识快照和本机 CLI；不要把被忽略的私有配置或缓存目录发布成静态目录。

本轮保留了两份扩展前基线：

| 备份 | 范围 |
| --- | --- |
| [before-expansion.tar.gz](../artifacts/mirror-sea-baseline/before-expansion.tar.gz) | 扩展前的源文件与工作状态基线 |
| [production-before.tar.gz](../artifacts/mirror-sea-baseline/production-before.tar.gz) | 扩展前的 `dist` 生产构建 |

回退时先将压缩包解到独立目录检查，再停止应用、配套恢复源码与构建；不要直接覆盖当前未备份工作树。两份扩展前归档不包含本轮新产生的个人浏览器档案。服务端内容库使用 SQLite WAL：需要备份时先正常停止应用，再整体复制 `artifacts/content-service`，保留数据库、伴随文件与访问配置；浏览器个人档案通过页面 JSON 导出另行保存。

## 7. 验收记录与复测命令

以下结果来自本轮实施与验收，不表示执行下列命令会重新发起真实知乎调用：

| 检查 | 本轮结果 |
| --- | --- |
| 内容服务 | 12 组通过，覆盖重启缓存、并发合并、预算事务/跨日、失败、来源边界、参数注入、会话与 AI 并发 |
| 个人数据 | 29 组通过，覆盖迁移幂等、备份/失败、旧字段与 links、多摘录、别名、JSON 往返和共享适配 |
| 星系 | 80 项通过 |
| 酒境内容 | 2 组通过；十种组合、五步活动、每境六份真实材料和作品表达 |
| 酒境导航/几何 | 1104 项通过；含全部 55 处陆地/酒境停靠点、可达性、碰撞、坏视角恢复和几何属性 |
| 酒境素材 | 资产预算、Draco 几何一致性和 WebP/透明纹理检查通过 |
| 原场景契约 | home、observatory、look、garden 检查通过 |
| 星系连接 | 8 组通过；真实页面回调/效果与 Express HTTP、视觉子组件桩，无外部业务请求 |
| TypeScript/改动文件 ESLint | 通过；定向记录见 [changed-lint.txt](../artifacts/mirror-sea-acceptance/changed-lint.txt) |
| 全量 ESLint | 仍有 12 个位于原有未改文件的错误，主要是组件混合导出规则及 sidebar 渲染中的随机数；见 [lint-after.txt](../artifacts/mirror-sea-baseline/lint-after.txt) |

```sh
npm run test:content
npm run test:personal
npm run test:galaxy
npm run test:journeys
npm run test:home
npm run test:observatory
npm run test:look
npm run test:garden
npm run test:galaxy-connection
npm run build
```

自动业务测试使用桩或固定公开内容，不消耗知乎检索/AI 额度。此前已用最小真实请求验证搜索返回 10 条、真实问题回答列表返回 20 条，并在独立进程确认缓存命中；一次使用公开精选材料的真实 AI 合成验证了草稿及来源。`scripts/content-live-check.ts`、`scripts/content-ai-check.ts` 默认仅读既有证据或缓存，只有显式 `--live` 才允许新的真实调用，运维时无需反复调用上游确认。

### 性能与画面证据

场景素材审计见 [budget-report.json](../artifacts/journey-assets/budget-report.json)，统计的是冷缓存下唯一场景资产的响应体字节，包括纹理、HDR、大树及所需本地 Draco 解码器：

| 场景类别 | 场景资产字节数 |
| --- | ---: |
| 含大树的白昼场景 | 11,503,338 |
| 不含大树的白昼场景 | 4,624,502 |
| 不含大树的夜景 | 4,947,548 |

这不是页面总下载量。应用 JavaScript、CSS、字体、API 响应和此前访问的其他路由不在统计范围内；不能据此声称完整首屏总 payload 小于 12 MB。HTTP 压缩和缓存也会改变实际网络传输量。

本机 1280×720、流畅档完成了全部十种酒境的连续切换，页面始终只有一个 Canvas。首次两秒诊断采样包含加载/编译，十境出现约 5.5–54.1 FPS 的波动；多场景在等待稳定后约 60 FPS。此结果证明常态可流畅运行，不能替代所有场景冷启动和所有设备的长期平均 45 FPS 验收。流畅档的新陆地/酒境关闭实时阴影，小屋和观星台仍按原有低分辨率阴影配置运行。

反复进入苔藓来信与蓝调快门时，几何、纹理、绘制调用和三角面数量分别与初次对应场景完全一致。共享纹理和模型缓存会保留用于复用；每次挂载独有的几何、材质克隆、控制器和监听器在卸载时释放。资源计数稳定不等于已完成所有 GPU 驱动的长期泄漏证明。

实测数据与截图位于 [mirror-sea-acceptance/](../artifacts/mirror-sea-acceptance/)，包括 [route-audit.json](../artifacts/mirror-sea-acceptance/route-audit.json)、十境画面和 390 像素宽移动布局截图。移动端已检查窄屏布局，尚未使用真实手机 GPU 验证。最终 [发布检查](../artifacts/mirror-sea-acceptance/release-check.md) 记录了调酒取消、音乐视觉反馈、个人空间及正式服务验证；可查看正式 [落日大道](../artifacts/mirror-sea-acceptance/production-sunset.png) 和 [回声悖论](../artifacts/mirror-sea-acceptance/production-echo.png) 截图。
