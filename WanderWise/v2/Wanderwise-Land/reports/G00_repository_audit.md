# G00 当前源码审计

基线：v2 / 2c80d9bf；工程为 WanderWise/v2/Wanderwise-Land。制作包是设计输入，不是已实现代码。回滚归档及 SHA-256 见 G00_baseline/baseline.json。工程内原有跟踪文件干净；仓库另一个目录的 README 修改保留。

运行：Python 3.12，`.venv/bin/python start.py --use-current --no-install --no-browser --port 18093`；本机验收服务使用独立临时 SQLite 测试库，不连接生产库。普通用户仍使用 `python3 start.py`。FastAPI `/static` 提供 frontend，Netlify 预构建保留 tools/build-netlify.mjs。没有迁移数据或后端。

|责任|当前实现|
|---|---|
|小屋构造/GLB加载|frontend/engine/home-scene.js；配置 scene.json；COL/SPAWN/INTERACT 白名单|
|主世界/文章场域|frontend/engine/scenes.js；旧顶点几何适配 BufferGeometry|
|显示/灯光/纹理|renderer-three.js；同源 Three.js 0.186.0，GLTFLoader 同版|
|相机/移动/输入|engine.js；home-physics.js 提供 Rapier 0.19.3 控制器及独立球形相机扫掠|
|边界/遮挡|小屋模型 COL，配置 bounds；世界旧简化碰撞；interaction.js 距离与遮挡|
|中文|Three CanvasTexture + Sprite；系统字体运行时绘制，不打包系统字体|
|设施选择|interaction.js，3m 内近邻；原文近邻左键；无准星|
|业务回调|app.js engineAction -> 原有面板；storage.js 访客 IndexedDB 隔离|
|销毁|scene.dispose -> Rapier World.free / disposeTree；renderer.dispose 释放共享环境与文字缓存|

setScene 为 async。调用者：Engine constructor ready；retryScene 返回 promise；app.home、startWorld、loadJourney、enterField、leaveField、retryRenderer 均等待切场。world-update.js 增量更新场景，不通过整场 setScene 刷新，保留鼠标漫游状态。切场使用 AbortController、sceneEpoch、18秒超时与迟到资源释放。

一份活动 WebGLRenderer，setAnimationLoop 一个主循环；保留 legacy 只在显式互斥选择时构造。模拟 dt 截断 .04，统计使用未截断 rawDt。renderer.vp 仍为同一投影矩阵的兼容数据；不存在把旧 WebGLTexture 传到 Three 的路径。角色动态几何仍逐帧生成，是现有成本而非本轮已优化项。

业务动作保持 door→seed、cabinet→bag、synthesis→synthesis、journal→journal、phone→phone。WASD/Space/E/F/B/R/T/V/Esc/左键保留，电话亭继续未开放。用户后续明确删除 2D，优先于制作包旧降级建议：不重新加入。

本轮基线截图 before.png 与 browser.json 来自 Chrome 实时 WebGL；不是历史离屏图。首次测试脚本误用了字符串 predicate 被 CSP 阻止，改为函数 predicate 后通过，未放宽 CSP。
