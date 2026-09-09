# 林间灯火 · 源码审计（改造前）

基线：`93e8ee6499274e63df9a7a0e363b530a58da9510`，2026-09-09。实际源码为 ES Modules / 自制 WebGL2；没有 Three.js、R3F 或 React。

| 职责 | 实际位置 | 审计结论 |
| --- | --- | --- |
| 场景构造 | `frontend/engine/scenes.js:4` | buildScene 同步构造位置/法线/颜色交错数组，home/world/field 共用。设施 ID 和动作在 home 分支内。 |
| 绘制/投影 | `renderer.js` | 原始 WebGL2；每帧 begin / draw(scene) / draw(dynamic) / text。vp 由 65°、near .08、far 650 的透视相机生成。 |
| 相机/移动/跳跃 | `engine.js` | 第三人称轨道相机、指针锁定、WASD、逐轴 AABB 移动、重力、安全落点。 |
| 边界/碰撞 | `scenes.js` + `engine.js:move` | home boundary=9；move 同时检查 x±8.6、z[-8.2,7.65] 与 boundary-2，实际更窄。墙、家具、相机、交互遮挡共用 colliders。 |
| 中文文字 | `renderer.js:textTexture` | 系统字体→Canvas2D→CPU SDF→原始 WebGLTexture，不能作为 Three Texture 复用。 |
| 设施选择 | `engine.js:pickTarget` | 依赖 renderer.vp 与 project()；home 4.5 米距离、屏幕中央锥、视线 AABB。标签未按 3 米限制。 |
| 业务回调 | `app.js:engineAction/perform` | door→seed，cabinet→bag，synthesis→synthesis，journal→journal，phone→phone。菜单与空间入口共享同一业务函数。 |
| DOM/输入隔离 | `app.js:openPanel/closePanel` + engine 监听 | 打开面板暂停/退出指针锁；文本输入及 composition 不进入游戏键处理。 |
| 存档 | `app.js` + `storage.js` | 服务器合同、访客 Cookie、IndexedDB、标签页租约与检查点；本次保持数据/业务 ID/接口不变。 |
| 销毁 | `engine.dispose` / `renderer.dispose` | 撤销 RAF、监听器、GPU buffer/VAO/纹理/program；缺少 GLB 资源所有权。 |

## 必须修复的六点

1. `setScene()` **同步**，构造器隐式调用；`updateWorld()` 同步转调（应用未引用）。应用调用位置：home、loadJourney、expandNode、enterField、returnWorld、perform(local-home)。全部必须适配异步、取消与迟到结果。
2. 小屋移动边界双重硬编码。新场景以显式 bounds 和命名碰撞体作为唯一空间来源；旧版互斥回滚保持旧行为。
3. 拾取依赖 renderer.vp。迁移后 vp 必须来自实际 Three PerspectiveCamera 的 projection × matrixWorldInverse。
4. 原始 WebGLTexture 不跨渲染器复用。中文重新创建同源系统字体 CanvasTexture。
5. 当前仅 Engine 一个 RAF 链；constructor 与 frame 的 requestAnimationFrame 是同一个链的启动和续约，不是两个循环。不得增加第二条循环。
6. 原 FPS 使用 `min(.04, rawDelta)`，会低估慢帧；改为原始毫秒帧时间统计，中位数/P95 与物理 dt 分开。

## 基线证据与备份

- 本轮真实 Chrome 152 / 1920×1080 / DPR1 / 本机 HTTP 截图：`evidence/before-home.png`。
- 相机与原版诊断：`evidence/before-home.json`。位置 (0,0,3.6)，yaw=0，pitch=.22，distance=5。基线显示的 60 FPS 不是可信性能验收值（上述 dt 问题）。
- 邻接目录 `../rollback-before-home-upgrade/`（相对项目根目录）包含源码归档及 SHA-256；不含密钥、依赖或用户存档。
- 测试使用独立数据库 `/private/tmp/wanderwise-home-upgrade-20260909.sqlite3` 与独立浏览器身份。没有连接公网生产存档。

## 素材现状

Lovely Living Room 官方当前文件名 **Tiny Treats - Lovely Living Room v1.1**，未取得付费文件，不能声称已整合。House Plants 免费版本可合法取得，Source (.blend) 是另一个付费层级。先采用作者官方 KayKit Furniture Bits 1.0 免费 CC0 家具验证真实 glTF/GLB；不使用付费素材的商城图、原模型或 AI 重制。

官方来源：https://tinytreats.itch.io/lovely-living-room 、https://tinytreats.itch.io/house-plants 、https://kaylousberg.itch.io/furniture-bits 、https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0 。完整选材清单、许可原文及 SHA-256 在资产导入后记录。
