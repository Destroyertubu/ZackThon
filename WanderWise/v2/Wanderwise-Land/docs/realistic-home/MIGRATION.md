# 渲染、物理及生命周期

## 保留与替换

保留 Three.js 0.186.0、原生 ES Modules/DOM、Python/SQLite、Netlify Functions/Blobs、storage.js 和业务动作。只重建小屋资产，加入小屋专用 Rapier；主世界、文章场域、金句靠近点击、增量 Worker 扩展继续使用原有实现。

`home-scene.js` 同源获取配置和 GLB，读取白名单设施、出生点和三种碰撞层，然后等待 Rapier 初始化。`Engine.setScene` 保持 loading/ready/error；模型、碰撞、异步 shader 编译和第一帧完成后才 ready。它沿用 AbortController、epoch 和 18 秒超时，取消不会安装迟到结果。

## 照明与材质

- 一盏主要投影方向光；两盏低成本不投影暖色点光，对应桌灯位置；半球和环境补光受控。
- PMREM 环境在同一个渲染器上一次性生成，128 级输入，用于 PBR 环境反射。它是可解释的环境近似，不是房间烘焙光照、实时全局照明或贴在窗外的图片。
- 窗外是独立树干/树冠几何；不会读取外部 CDN 或商城预览图。
- 默认中画质 2048 阴影、低画质 1024；DPR 中画质上限 1.4，低画质 1。
- 薄窗帘接受材质与直接照明，但不参与阴影投射/接收，避免薄表面自阴影条纹。玻璃只作为透明外观，不使用高成本物理透射。
- 家具保留 GLTFLoader 导入的 sRGB 与数据纹理语义；不重复更改颜色空间。新建筑 UV 为米制投影；织物为自制切线法线。
- 无 Bloom、粒子、SSAO、光照烘焙、实时反射探针更新。原模型 ARM 中的局部 AO 不重复烘焙一次。

## 三种碰撞规则

1. **角色**：0.28 米半径、总高 1.5 米胶囊；`computeColliderMovement` 的修正位移才写入玩家状态。每帧跟随原主循环执行，无独立定时器；沿用 4.5 m/s 和 3.96 m/s 跳跃初速度。地面、家具、门叶、墙及顶棚参与，玻璃按显式代理处理。
2. **相机**：0.17 米球体从目标向相机扫掠，覆盖当前 0.08 米近裁剪面的范围；平滑后的最终相机位置再次检测。电话亭侧玻璃不挡相机；墙、柜、桌和窗框仍挡相机。
3. **交互**：原 `interaction.js`/segmentBox 路径，设施 3 米内、头部到设施无遮挡，才可左键打开。透明玻璃、窗帘没有错误地封锁操作；门洞分段碰撞，未用整面墙盒封死。

房间边界保留旧 12×10 米范围。若旧存档中的家园位置被新家具占据，仅将本次加载的角色放到安全出生点，不改变收藏/旅程 ID。

## 资源所有权

| 所有者 | 资源 | 释放时机 |
|---|---|---|
| home-scene 返回的 scene | GLB geometry/material/texture；每场景 Rapier World/controller | 成功换场或 Engine.dispose；资源集合去重释放 |
| Rapier 模块 | 固定版本 JS/WASM 初始化 | 模块级共享；无重复加载、无后台物理循环 |
| Renderer | PMREM render target、旧几何适配材质、批次、中文标签缓存及 shadow map | Renderer.dispose；标签缓存仍限制为 80 |
| GLTFLoader 加载结果 | 被取消后才到达的 GLB | abortable 的 late 回调释放 |
| world-update | Worker | 原有完成/失败/取消/销毁终止逻辑保持 |

只有一个活动 Canvas、一个 WebGLRenderer、一个 setAnimationLoop。`draw()` 仍只控制批次，`end()` 统一渲染。旧 `?renderer=legacy` 互斥，不能后台同时运行。

本地与云端 CSP 仅新增 `wasm-unsafe-eval`；JS `unsafe-eval` 未开放。后端业务接口、数据库、知乎适配器未重写。

## 工具使用边界

读取并遵循 Game Studio 四个专项技能及其参考文档（源码快照 0.1.2），保留原有项目结构和用户快捷键约定。Blender MCP/Chrome DevTools MCP 当前没有可调用工具，实际使用本机 Blender Python 与 Playwright/Chrome CDP。没有声称安装未提供的项目质量 ZIP，也没有调用额外生成服务。
