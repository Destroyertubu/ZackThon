# 渲染迁移：林间灯火 · 知识书屋

版本 1.1.0-home.1。本轮只改前端渲染、资产及开发/交付工具；Python、Netlify Functions/Blobs、SQLite、知乎适配、storage.js 与业务 ID 保持原样。没有部署本轮修改。

## 模块与帧流程

| 模块 | 新版职责 |
| --- | --- |
| app.js | 原 DOM/业务入口、存档、路由；异步切场意图与加载/错误面板；2D/旧版互斥选择 |
| engine/engine.js | 单一 setAnimationLoop、第三人称移动/跳跃、暂停、镜头阻挡、拾取、原始帧耗时 |
| engine/renderer-three.js | 唯一 Three WebGLRenderer、Camera/vp、旧几何缓冲适配、PBR/阴影、中文 CanvasTexture、GPU 释放 |
| engine/home-scene.js | 同源 JSON/GLB 加载、取消、语义节点/白名单、碰撞/出生点验证、场景资源租约 |
| engine/scenes.js / geometry.js / math.js | 原世界、正文场域、角色几何和数学，保持原实现；经适配器渲染 |
| engine/legacy/ | 原 WebGL2 小屋/世界/引擎，仅 renderer=legacy 时动态导入 |
| engine/render-qa.js | 仅 localhost 且 qa=1 导入；可重复相机姿态和只读渲染诊断，不写业务存档 |

每帧 begin → 更新两个几何批次与标签 → end 一次整场景 render。阴影由 Three 同一次 render 管理；没有把旧 draw 逐个变成整场景 render。一个活动 canvas、一个渲染器、一个 RAF 链。2D 冷启动不下载 Three/GLB，切到 2D 释放活动引擎。旧版通过 URL 互斥加载，路由和刷新保留 renderer=legacy。

## 异步与输入

setScene()/updateWorld() 现在返回 Promise。构造器暴露 ready；app 的 home、loadJourney、expandNode、enterField、returnWorld、local-home 及重试均等待结果。sceneIntent 阻止旧业务网络结果覆盖新场景，Engine epoch + AbortController 阻止迟到 GLB 安装；重复引擎创建使用同一个进行中的 Promise。

loading 时暂停且禁止移动；配置、模型、碰撞、着色器编译与第一次真实渲染完成后才 ready。18 秒边界覆盖加载/编译/首帧；失败显示 error、重试与 2D 入口。取消后释放迟到模型；正在加载时不把小屋坐标写入世界/场域检查点。

保留 WASD、跳跃、准星、左键设施激活、暂停、输入框与中文组合输入隔离。失焦/隐藏时暂停。指针锁定可用时沿用；无法锁定时可右键拖动视角。菜单保留等价业务入口。

## 相机、碰撞与语义

Three PerspectiveCamera 65°、near .08、far 650。renderer.vp 直接取实际相机 projection × view，屏幕拾取与显示一致。镜头臂与平滑后镜头各检查相机碰撞，不能用忽略墙体修复穿墙。

室内约 12 × 10 × 4.4 米，Y-up、1 单位 1 米。scene.json 给出移动 bounds；不沿用旧小屋硬编码。COL_* 的 player/camera/interaction 独立：窗玻璃、电话玻璃不挡交互射线或镜头，木柱/背板/家具阻挡；窗帘不作碰撞。门洞墙体分段，门叶有单独碰撞；门是原来的起程入口，没有新增开门动画。家具用少量简化盒，书本不逐本碰撞。

VIS_* 按建筑/设施所有者有限合批；门叶、设施、COL_*、SPAWN_*、INTERACT_* 保留独立节点。INTERACT 名称只映射固定白名单：door→seed、cabinet→bag、synthesis→synthesis、journal→journal、phone→phone；不执行 extras 字符串。设施 3 米内显示中文标签并可左键激活，同时验证玩家头部及相机两条视线，墙后不可触发。电话亭继续显示未开放。

## 材质与光照

glTF/PBR：暖木、灰泥、布料采用不同粗糙度，少量黄铜采用金属材质。GLTFLoader 保留颜色/数据贴图语义，不重复改色彩空间。旧顶点颜色从 sRGB 转线性。中文由系统字体 Canvas2D 新建 CanvasTexture，绝不复用原 WebGLTexture。

一盏主要 DirectionalLight 投影，两个不投影的补光加半球光；中画质 2048 阴影，低画质 1024。无 Bloom、无粒子、无灯光烘焙、无 AO/lightmap，不把 emissive 当作完整照明。GLB 内嵌一张 KayKit 基色图集，无法线/粗糙度贴图，无压缩扩展，因此不需要解码器。窗外是少量实时几何，非贴图背景。

为兼容原 CSP，GLTFLoader 的嵌入图片使用 TextureLoader/图片元素而非 ImageBitmapLoader 的 blob fetch；仍沿用原 img-src blob:，未放宽后端 CSP。图片失败进入 error。库、GLB 与纹理均同源，未接 CDN。

## 资源所有权和性能统计

场景租约拥有 GLB 的 geometry/material/texture；切场先卸载旧根再按对象集合去重 dispose，共用图集只释放一次。渲染器拥有旧几何批次、动态缓冲、文字缓存、灯光阴影目标。文字缓存上限 80，切场清理；引擎 dispose 撤销循环/事件/在途加载并释放渲染器。语义节点不共享可执行代码。

rawDt 与截断为 .04 秒的模拟 dt 分开。中位 FPS = 1000/原始帧耗时中位数，P95 使用原始毫秒；帧追踪有上限，验收脚本定期收集而不新建 RAF。Three drawCalls/triangles 包含阴影通道，是比纯可见面数更保守的工作量统计。GPU 计数稳定仅支持本次设备/测试期间未观察到增长，不等于所有平台无内存泄漏。
