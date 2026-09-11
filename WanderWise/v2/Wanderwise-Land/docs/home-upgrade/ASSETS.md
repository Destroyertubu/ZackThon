# 资产与许可登记

2026-09-10，本地升级 1.1.0-home.1。真实运行使用“项目自制暖木书屋 + 一套 KayKit Furniture Bits 家具”，不是 Tiny Treats 商城场景，也不是离线渲染背景。没有购买、读取商业原始包或将受限素材输入生成式模型。

| 项目 | 来源/版本 | 实际取得与分发 |
| --- | --- | --- |
| Tiny Treats — Lovely Living Room | [作者官方页](https://tinytreats.itch.io/lovely-living-room)，文件 Tiny Treats - Lovely Living Room v1.1 | 缺少此付费文件，未购买、未导入、未分发；商城图不作为运行证据 |
| Tiny Treats — House Plants | [作者官方页](https://tinytreats.itch.io/house-plants) | 免费模型下载未在当前网络取得；Source (.blend) 是单独付费层级，也未取得。运行植物为下面的免费 cactus_medium_A |
| Kay Lousberg — KayKit Furniture Bits 1.0 | [作者页](https://kaylousberg.itch.io/furniture-bits)、[作者仓库](https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0/tree/96d5930a8dbdb363409bbc2d3341718b00e17c9c)，固定 commit 96d5930a8dbdb363409bbc2d3341718b00e17c9c | CC0；2026-09-09T15:57:52Z 取得所选 glTF/bin、共享图集、许可；允许随包分发原文件及派生 GLB，不包含收费 EXTRA/SOURCE |
| 项目自制书屋 | tools/build-home-blender.py，Blender 5.2.1 LTS，1.1.0-home.1 | 建筑、书柜、工作台、窗帘、门、电话、壁炉、日志等为项目原创 MIT；脚本、可编辑 .blend 与运行 GLB 随包 |
| Three.js | [官方 r186](https://github.com/mrdoob/three.js/tree/r186)，npm three 0.186.0 | MIT，vendor 内保留完整 LICENSE；导入路径改为同源相对路径，功能源码未改 |

每个实际文件的 SHA-256、大小、版本、作者、获取/生成时间、修改与分发方式见 ASSET_MANIFEST.json。KayKit 原下载时间、原始逐文件 SHA 见 assets-source/kaykit-furniture/provenance.json，许可原文见同目录 LICENSE.txt。项目原创许可见根 LICENSE。组合 GLB 中 KayKit 部分保持 CC0，原创部分 MIT；不能把项目 MIT 当成对第三方内容的重新授权。

## 所选与实际加载

只取得 8 件小型模型，没有下载整个资源仓库。全屋运行使用 table_medium_long、chair_B_wood、lamp_table、cactus_medium_A、armchair_pillows、book_set 六件。shelf_B_large、book_single 只作结构检查，保留原文件但不加载到运行场景。

原 glTF/bin/PNG 未修改；Blender 仅进行单位/轴验证、缩放、旋转、位置安排及按设施分组合批。armchair_pillows 按原图集 UV 区域将高饱和坐垫分配为鼠尾草绿布料与奶油色靠垫；原 PNG 保持不变。具体变换见 home-full.build.json / home-corner.build.json。原创模型采用倒角、曲线和布料网格细节，未把未经处理的基础方块作为全部家具成品。

室内可进入且连通；GLB 为可加载运行文件，不依赖 Blender 工程运行。Y-up、米制、VIS/COL/SPAWN/INTERACT 约定与碰撞通路由测试读取真实 GLB 验证。没有 Draco/Meshopt/KTX 压缩，不需要额外解码器。仅有基色图集，没有烘焙光照或 AO，避免错误重复叠加。

截图来自本轮 Chrome 中实际运行应用，视角 JSON 可复查。字体使用系统中文字体栈，不附字体文件；截图不是字体源文件分发。
