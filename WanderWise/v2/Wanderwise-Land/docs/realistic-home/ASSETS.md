# 资产来源与修改记录

本轮基线是写实木质知识书房。主家具为 Poly Haven CC0 模型；建筑、窗、门、桌、电话和陈设由 Blender 脚本定制。未购买素材，未使用限制 AI 的 Fab/Victorian Room，不使用商城图片作为运行背景。

| 资产 | 作者 | 获取版本/文件 | 运行处理 |
|---|---|---|---|
| Arm Chair 01 | Kirill Sannikov | ArmChair_01_2k.gltf + bin + diff/normal/ARM JPG | 原始约 5,626 三角面、1.065 米高；统一地面原点，两处实例；保留软包和木雕材质 |
| Gothic Cabinet 01 | Kirill Sannikov | GothicCabinet_01_1k.gltf + 贴图/bin | 约 12,170 面、2.361 米高；柜门独立网格保留；连接同一收藏库 |
| Shelf 01 | Gabriel Radić | Shelf_01_1k.gltf + 贴图/bin | 约 182 面、2.080 米高；新增书本按测得层板高度摆放 |
| Wood Floor | Dimitrios Savva | wood_floor_*_1k.jpg | 室内木地板与桌面；物理米制 UV，颜色/法线/粗糙度分开 |
| Plastered Wall 02 | Charlotte Baglioni | plastered_wall_02_*_1k.jpg | 灰泥表面；法线强度 0.45，统一纹理尺度 |
| Wood Planks Grey | Rob Tuytel | wood_planks_grey_*_1k.jpg | 审查过但偏风化，**最终模型不使用**，仅来源记录保留 |

官方来源：[Poly Haven](https://polyhaven.com/)，[许可说明](https://polyhaven.com/license)。资产 CC0 允许商用与源素材再分发；站点截图、宣传图和标识不在该资产许可之内，本轮不复制这些内容。
完整文件 URL、作者、发布时间字段、实际获取 UTC 时间、原始 SHA-256 和分发方式在 `../../assets-source/polyhaven/manifest.json`。原文许可 `../../assets-source/polyhaven/CC0-1.0.txt`。官方未提供语义版本号，因此以 API 发布时间及文件哈希固定版本。下载器还校验 API 提供的 MD5。

## 自制部分与数据语义

- `tools/build-realistic-home.py` 为可复现 Blender 5.2.1 LTS 脚本：米制建筑、凹进窗框、折叠窗帘、榫接/车木细节桌、灯罩、书、电话、花盆与叶片、门套、壁炉、碰撞和设施标记。
- `assets-source/home-realistic-full.blend` 含可编辑、已打包贴图的源场景；终端用户启动不需要 Blender。
- 自制 256² 织物法线为程序化切线空间数据图，明确接入 Normal Map 节点，不是光照或 AI 图片。
- 原 glTF 的颜色、法线和 ARM 语义保留；新建筑不烘焙光照，不把颜色图当光照图。家具原有 AO 仍来自原模型 UV/ARM；不是全屋 AO 烘焙。
- 可见 `VIS_*`、碰撞 `COL_*`、`SPAWN_*`、`INTERACT_*` 分开。柜门独立保留，动态门叶保留独立节点。
- 房间和桌沿使用倒角，细小书页边缘减少细分；曲线控制采样率，未对真实软包椅/柜进行盲目简化。

## 导出与分发

导出原始 GLB 后依次 inspect、dedup、weld、MikkTSpace tangents、JPEG90、validate。无全场景 flatten/prune/simplify，无 Draco/KTX2 外部解码器。JPEG 减小传输，不声称减小 GPU 解码后纹理内存。源文件未改动；运行 GLB 的纹理转码、切线生成、原点和摆放修改记录在 `frontend/assets/home/home-realistic-full.build.json`。

Three.js 0.186.0（MIT）、Rapier 0.19.3（Apache-2.0）均同源提供。Rapier 兼容包内嵌 WASM；不从 CDN 获取。`tools/workflows/game-studio` 保存所读官方 0.1.2 工作流的相对结构，仅作为开发参考，不是运行时依赖或已安装插件的声明。引用文档中的自定义 `wanderwise-3d-quality` ZIP 未随本次附件提供；没有声称安装或执行该 ZIP。
