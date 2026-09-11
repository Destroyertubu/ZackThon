# 写实小屋重做：源码审计（2026-09-10）

基线为 v2 / 980fadb8，旧版完整源码备份和 SHA-256 见 BASELINE.json。
本轮旧版浏览器截图及相机参数见 evidence/before.png / before.json。

| 职责 | 当前模块与本轮处理 |
|---|---|
| 场景构造 | scenes.js 保留主世界/文章场域；home-scene.js 加载新版 GLB、语义设施和碰撞；build-realistic-home.py 作者流程 |
| 渲染 | renderer-three.js 单个 Three.js 0.186.0 WebGLRenderer；旧几何批次适配仍在，新增一次性 PMREM 环境 |
| 相机与移动 | engine.js 保留第三人称输入与原始帧时间；home-physics.js 为小屋提供 Rapier 胶囊运动和独立相机球体扫掠 |
| 边界 | scene.json 和 COL_* 明确限定；保持旧房间 12×10 米可用边界，避免直接改变存档坐标语义 |
| 标签 | Three.js CanvasTexture 中文 Sprite；颜色管理独立；没有使用旧 WebGLTexture 句柄 |
| 选择/遮挡 | interaction.js 按距离选金句/设施；设施 3 米范围；角色头部到目标的碰撞遮挡保持，窗口/电话玻璃按层处理 |
| 业务 | app.js 保留 door→seed、cabinet→bag、synthesis→synthesis、journal→journal、phone→phone 白名单；后端路由、业务 ID、存档代码保持 |
| 销毁 | home-scene.js 拥有模型与每个 Rapier World；renderer-three.js 拥有共享旧几何材质、标签缓存、PMREM render target；加载取消和迟到模型释放保留 |

setScene 已是异步，有 loading/ready/error、18 秒超时、AbortController 和 epoch。它的 app.js 调用者原先已 await。本轮在 home GLB 和碰撞层准备完成后才允许 ready。
主世界增量扩展由 world-worker.js / world-update.js 更新，不改回全量 setScene。
仍只有一个活动 Canvas、一个渲染器和一个 setAnimationLoop；物理 world.step 在该循环中运行，没有第二个 RAF。
当前版本已按用户上轮要求删除简化阅读模式与准星，不重新添加；图形故障提供重试和低画质重试。

唯一服务配置变更：本地 Python、Netlify 与开发服务器的 CSP 增加 `wasm-unsafe-eval`，用于 Rapier WASM 编译。没有增加 JavaScript `unsafe-eval`，没有更换后端/数据库/部署平台或调用知乎与 AI。

旧 GLB、旧 Three 小屋源码生成器、原生渲染器回滚入口仍保留；完整回滚优先使用基线源码包。
