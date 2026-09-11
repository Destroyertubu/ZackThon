> 本报告记录 1.1.0-home.1 的历史验收。当前 1.1.1-roaming 已按用户要求删除 2D 与准星；当前检查见 ../roaming-update/README.md，不把这份 20 分钟记录当作新版重新实测。

# 本轮真实浏览器验收：林间灯火 · 知识书屋

日期 2026-09-10；版本 1.1.0-home.1。升级仅在本地完成，没有把当前 Netlify 公网页面当作新版验收。测试使用独立 SQLite 与全新浏览器访客，不读取或修改用户已有存档，不调用知乎或付费模型。

## 已实现

原生 Three.js 适配保留 DOM/业务层；旧世界、正文场域与角色几何继续渲染。新家园由真实 GLB、PBR 材质、单主光阴影和同源中文标签组成。先通过真实模型角落，再扩建约 12×10 米连通小屋。书柜、合成台、窗边日志桌、电话亭及起程大门保持原业务动作。电话亭如实未开放。

交付源代码、预制 frontend 与本地 dist、两份可编辑 .blend、复现脚本、原模型许可/SHA 清单、GLB/碰撞/语义配置、截图、测试脚本和旧版源码备份。最终用户仍通过 Python 启动，无需 Node/Blender。

## 实际验证

| 检查 | 本轮结果与证据 |
| --- | --- |
| 原版实拍与源码审计 | before-home.png/json；SOURCE_AUDIT.md；旧版性能显示因 dt 截断不作为有效比较 |
| 先行角落 | 3 项通过：真实键盘移动/跳跃、贴图/阴影、中文柜子空间左键打开真实收藏面板；corner-gate.json |
| 旧世界/正文适配 | 4 项通过：世界、正文场域、返回检查点、收藏回家并刷新；corner-world-gate.json |
| 完整业务链 | 19 项含持续测试通过；home-acceptance.json。五个空间设施逐一左键打开、中文输入隔离、推荐路线、正文与摘录、收藏去重、锚点、手工选材合成/保存、日志、保存回家和刷新 |
| 世界阅读操作 | 真实 Chrome Cookie/IndexedDB/CSP/HTTP；阅读及选材部分使用产品原有 2D UI，然后切回真实 3D 世界/场域，无进程内请求桥接或存储替身 |
| 遮挡/镜头/降级 | 电话背板后不可拾取，贴墙 8 个镜头角度保持室内，低画质、失焦暂停、2D 降级通过 |
| 异常与生命周期 | 10 项通过；home-failures.json：GLB 失败、贴图缺失、重试、2D 逃生、旧版互斥/刷新、迟到取消、销毁在途加载、2D→3D 单实例；额外 10 轮引擎切场 GPU 计数恒定、最多一个待执行 RAF |
| 鼠标模式补验 | 录制时发现锁定状态右键捕获异常，已限定只在非锁定模式调用 setPointerCapture；真实 Chrome 的锁定和拒绝锁定两种模式均通过，home-controls.json |
| 解压运行 | release-smoke.json：ZIP 全文件 SHA 校验、独立目录 Python 启动、PATH 不含 Node/Blender、真实 Chrome 小屋 ready、资源 HTTP 哈希吻合，电话面板正确 |
| 自动逻辑 | 22 项通过：原引擎 10、新 GLB/碰撞/语义/通路 6、存储身份 6；unit-tests.txt |
| 最终源码补验 | 18 项业务/遮挡/画质/输入检查与额外 10 次真实应用往返通过；final-source-check/home-acceptance.json；这是短回归，不算第二次 20 分钟 |
| 可分发前端 | 18 个本地 ES Modules 语法检查通过，build:cloud 本地生成通过；build.txt（不代表部署） |

房间通路测试读取实际 GLB 的 COL 与 SPAWN 节点，在角色半径网格上验证全部设施可达，并验证按原行走速度到大门少于 10 秒；浏览器另实测真实移动和跳跃。未把脚本相机摆位当作实际行走路径测试。

## 性能与持续运行

实测设备：ANGLE (Apple, ANGLE Metal Renderer: Apple M5, Unspecified Version)；macOS-26.6.2-arm64-arm-64bit，Chrome 152.0.7977.83，有界面窗口 1920×1080，DPR 1。本机 HTTP、全新浏览器 context、无浏览器磁盘缓存；操作系统文件缓存未清空。未做公网限速或弱网模拟，不能外推到手机/集成显卡/远程下载。

| 指标 | 实测 | 目标对照 |
| --- | --- | --- |
| 冷浏览器到 ready 且首帧实际呈现 | 1.71 秒 | 本次条件下 <8 秒 |
| 首屏子资源实际传输 | 7,600,927 B（约 7.60 MB），另 HTML 904 B 及其响应头 | 本地服务未启用压缩，已经 <15 MB；不是估算 gzip 后值 |
| 中画质中位 FPS | 59.88 | ≥45 |
| 中画质 P95 原始帧耗时 | 17.60 ms | ≤33 ms |
| 原始可见帧样本 | 72,138，包含切场 | raw-frames.json.gz；未使用物理截断 dt |
| 低画质抽样 | 中位 59.9 FPS / P95 18.3 ms | 本次 ≥30 FPS；只短时抽样，无单独低画质 20 分钟测试 |
| GLB 全部可见网格 | 93,438 triangles（包含屋外几何，不含角色、文字及阴影重复通道） | <200k |
| 常态出生视角 | 115 draw calls / 177,600–177,644 triangles | 包含阴影通道，非纯可见面数 |
| 对角视角截图 HUD | 123 draw calls / 约187k triangles | 本次观察范围 <150 / <200k；未穷举所有视角 |
| 连续运行 | 1203.56 秒（超过 20 分钟） | 同一浏览器，间隔真实键盘移动，非持续人工操控 20 分钟 |
| 真实应用往返 | 10 次家园/世界往返 | 通过 |
| 稳定姿态 GPU 前/后 | 62 geometry / 4 texture / 9 program，均相同 | 未观察到增长；不等同于完整 JS 堆泄漏证明 |
| 页面异常 | 0 | 本轮采集范围内 |

录制补验发现的右键问题在持续测试之后修复；渲染和模型不变，最终输入分支另经 home-controls.json 与重新录制验证。

原始每轮 HUD 曾因一秒刷新间隔采到上一世界数值；稳定姿态前/后以及独立生命周期脚本直接读取渲染器计数，均稳定。最终源码诊断已改为即时合并资源计数。持续测试期间运行 GLB SHA-256 为 `475b82f8abc5b1ad777b5e0653e514546ab0df22b8949840441c2f2ba8b5fc59`；后来补充的初始化/路由/诊断保护由 final-source-check 另跑最终源码短回归，未重复宣称第二次 20 分钟。

## 真实画面

[原版出生视角](evidence/before-home.png) · [新版出生](evidence/final-spawn.png) · [全屋对角](evidence/final-diagonal.png) · [窗边细节](evidence/final-window-detail.png) · [壁炉细节](evidence/final-hearth-detail.png) · [低画质](evidence/final-low-quality.png)

[收纳柜](evidence/facility-cabinet.png) · [合成台](evidence/facility-synthesis.png) · [日志](evidence/facility-journal.png) · [电话亭](evidence/facility-phone.png) · [大门](evidence/facility-door.png) · [世界](evidence/final-world.png) · [正文场域](evidence/final-field.png)

这些全部是本轮应用运行截图。为重复取景使用仅 localhost/qa=1 可用的相机控制，参数见 acceptance-viewpoints.json；不是 Blender 离线图、商城图或 AI 图。低画质截图在独立画质设置下记录。先行角落截图保留阶段性成果；早期失败/未完成预览不作为最终画质证据。

## 未验证或受阻

- 未取得 Tiny Treats — Lovely Living Room v1.1 付费文件；House Plants 免费下载在当前网络未取得。采用一套已核验 CC0 KayKit 家具与原创暖木模型，不能称为指定 Tiny Treats 素材整合完成。
- 未部署本轮升级到公网；既有 Netlify 网址仍是旧版。预构建 dist 并不代表线上 HTTPS/浏览器验收完成。
- 本轮不验证真实知乎/真实 AI，有效性仍沿用原交付限制；电话匹配仍未开放，没有假用户。
- 本次仅 Apple M5/macOS/Chrome；Windows、Linux、Safari、Firefox、手机、高 DPR、弱网与低端 GPU 未实机复测。Python 启动保留跨平台脚本不等于所有平台实测。
- 未做 JS 堆完整剖析、长于 20 分钟的压力测试或每个相机姿态的自动画面判定。正常截图与抽样近景已检查，但不宣称所有可能位置绝无穿插。
- 未制作烘焙 AO/灯光贴图、动态开门动画或受版权限制的商业模型；这些不冒称已实现。

## 实际漫游视频

[真实键鼠漫游短片](evidence/home-walkthrough.webm)，Chrome 1280×720、独立访客、实际键盘移动、跳跃与鼠标转镜头，没有使用 QA 瞬移或离线画面。位置记录及异常采集见 video-recording.json。此视频不用于 1080p 性能统计。
