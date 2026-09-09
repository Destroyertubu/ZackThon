---
title: "陆地方向 Three.js / 3D 开放世界素材清单"
date: 2026-09-09
language: zh-CN
tags:
  - Threejs
  - Zhihu-Hackathon
  - 3D-Assets
  - Open-World
  - Landscape
---

# 陆地方向 Three.js / 3D 开放世界素材清单

面向「知乎知识探索」的森林、山谷、河流、遗迹、村落与营地。

本清单沿用用户提供的星空素材文档的组织方式：先列现成模型、纹理与环境资源，再列可以借鉴或接入的 Three.js 程序化地形、植被、水面和交互代码。本文中的「用于你们项目」和组合方案属于设计建议，不是这些资源已经实现了知乎接口或知识世界生成。

核验日期：2026-09-09。已核对下列官网、作者发布页、仓库或官方文档；未逐一下载全部压缩包、执行仓库代码或完成浏览器兼容性测试。文件数量、模型数量、完整包数量与免费版数量按来源分别表述，不混用。

## 先给选择结论

**第一人称自然探索优先：KayKit Forest Nature / Quaternius 自然包（二选一作为主风格）＋连续地形＋Three.js Sky / Water＋地面移动与碰撞。**

**最快搭出可视化知识大陆优先：KayKit Medieval Hexagon＋同系列森林植被＋关键词标牌。**

不要把「陆地方向」理解为在平面上放满树。我建议用山谷承载知识领域、路口承载关键词分叉、遗迹承载长文、营地承载存档与知识合成。

## 重要：Quaternius 的许可证需要按具体版本核对

本次发现：Quaternius 的若干旧素材包页面及 itch.io 页面仍标注 CC0；但其官网许可证页面已显示 **2026-08-28 更新的 Quaternius Asset License（QAL）v1.0**。QAL 允许将素材用于个人、教育及商业作品，但限制把素材本身作为独立素材或素材包再次分发。页面也说明后续更新不追溯改变此前取得的版本。

因此，下表的 Quaternius 项目标记为「包页 CC0；需核对版本」，**不将整个站点笼统归为 CC0，也不推断旧 CC0 授权自动失效**。新下载时保存包内许可证、具体版本和下载日期；页面与包内条款不一致时，在公开镜像原始素材前向作者确认。

来源：[Quaternius 当前许可证](https://quaternius.com/license.html)；[仍标 CC0 的 Stylized Nature MegaKit 包页](https://quaternius.com/packs/stylizednaturemegakit.html)。

# 一、第一梯队：现成森林、地形、建筑与道具

## 1. 快速资源总表

| 资源及官方入口 | 核实的内容与获取范围 | 格式 / 许可证 | 建议用途 |
| --- | --- | --- | --- |
| [KayKit Forest Nature Pack](https://kaylousberg.itch.io/kaykit-forest) | 免费版 100+ 树木、岩石、灌木、草；模块化地形属于 EXTRA 扩展 | FBX、glTF、OBJ；CC0 | 森林、草地、主题区域装饰 |
| [KayKit Medieval Hexagon Pack](https://kaylousberg.itch.io/kaykit-medieval-hexagon) | 免费版 200+ 模型；道路、河流、海岸、建筑、山丘等；部分单位和扩展内容另付费 | FBX、glTF、OBJ；CC0 | 可拼接知识大陆、村落、总览地图 |
| [Kenney Nature Kit](https://kenney.nl/assets/nature-kit) | 官方标示 330 项文件，分类为自然、树、岩石和植被 | 官方 ZIP；CC0 | 轻量低模环境与原型 |
| [Kenney Castle Kit](https://kenney.nl/assets/castle-kit) | 官方标示 75 项文件，城堡与中世纪主题，带变体 | 官方 ZIP；CC0 | 知识地标、领域入口 |
| [Kenney Survival Kit](https://kenney.nl/assets/survival-kit) | 官方标示 80 项文件，生存与自然主题，包含动画 | 官方 ZIP；CC0 | 营地风格的地面设施与道具 |
| [Quaternius Ultimate Stylized Nature Pack](https://quaternius.com/packs/ultimatestylizednature.html) | 60+ 自然资产，包含无缝纹理与法线贴图 | FBX、OBJ、glTF、Blend；包页 CC0，核对版本 | 风格化森林、山谷、林间空地 |
| [Quaternius Stylized Nature MegaKit](https://quaternius.com/packs/stylizednaturemegakit.html) | 完整系列 116 个独立模型；Standard 是免费子集，PRO / SOURCE 另付费 | FBX、OBJ、glTF；Blend 与引擎工程看版本；核对许可 | 更丰富的风格化自然环境 |
| [Quaternius Ultimate Modular Ruins Pack](https://quaternius.com/packs/ultimatemodularruins.html) | 模块化遗迹、地牢、角色与道具 | 包页列 FBX、OBJ、Blend，未列 glTF；核对许可 | 历史遗迹、知识档案入口 |
| [Quaternius Medieval Village MegaKit](https://quaternius.itch.io/medieval-village-megakit) | 完整系列 300+ 模块，含墙、楼板、楼梯、屋顶；Standard 与付费扩展分开 | FBX、OBJ、glTF；核对许可 | 主题村落、旅程终点、知识工坊 |

**Kenney 格式说明：**上述单包官网页面未逐项列出文件扩展名，本次没有解压核验，因此不承诺每个包都已经提供 GLB。取得 ZIP 后先查格式；对于没有 glTF 的模型，安排离线转换，而不是假定可以直接交给 GLTFLoader。

## 2. KayKit Forest Nature：我会优先选的轻量森林

该包免费版含 100+ 模型，提供 FBX、glTF 和 OBJ；作者使用一张 1024×1024 渐变图集组织纹理，并说明可降采样。模块化地形、更多变体属于 EXTRA 版本，而不是免费版默认内容。[官方包页](https://kaylousberg.itch.io/kaykit-forest)

建议先从同一套包挑少量树、岩石、灌木与草作为基础词汇，通过大小、朝向、组合密度和局部配色形成不同区域。不要为了显得丰富而混入大量风格不一致的模型。

应用举例：哲学林地用稀疏大树和安静空地；技术林地用更清楚的路径与路口；生活话题区用更低矮、开阔的植被。这些是场景编排建议，并不是用颜色推断知识本身的属性。

## 3. Quaternius 自然包：更适合细腻的风格化山谷

**Ultimate Stylized Nature Pack** 是较直接的起点，包页列出 60+ 自然资产、无缝纹理和法线贴图，包含 glTF。[资源页](https://quaternius.com/packs/ultimatestylizednature.html)

**Stylized Nature MegaKit** 的完整系列包含 116 个独立模型；官网同时说明 Standard 只涵盖系列的一部分，PRO 增加模型，SOURCE 增加 Blender 源文件及 Unity、Unreal、Godot 工程与自定义着色器。[官网版本说明](https://quaternius.com/packs/stylizednaturemegakit.html) · [作者下载页](https://quaternius.itch.io/stylized-nature-megakit)

不要将「完整系列 116 个模型」写成「116 个模型全部免费」，也不要把引擎工程中的草地风动和树叶着色当成 Three.js 导入后自动具备的效果。对于 Web 项目，应单独评估模型几何、贴图和需要重新实现的着色效果。

## 4. KayKit Medieval Hexagon：最快拼出知识大陆

免费版含 200+ 模型，提供道路、河流、海岸、湖海地块，以及房屋、磨坊等建筑和自然物；资源采用 glTF 等通用格式。作者同时发布了 GitHub 资源仓库。[作者包页](https://kaylousberg.itch.io/kaykit-medieval-hexagon) · [GitHub](https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0)

它很适合把知识探索做成分区地块：一个地块承载一组关键词，路口承载选择，道路承载旅程，跨区连接由桥梁或关口表达。

但我会把它优先用于鸟瞰地图或快速原型。第一人称主场景需要额外检查建筑尺度、门洞、坡度、拼缝与可走区域，不能仅将一张桌游地图整体放大。

## 5. 遗迹、村落与营地：让素材承担具体功能

**Ultimate Modular Ruins Pack** 适合做历史类文章入口、档案室或需要探索后解锁的空间。包页只明确列出 FBX、OBJ、Blend；我会将其标记为「准备 glTF 离线转换」，而不是直接可加载 GLB。[资源页](https://quaternius.com/packs/ultimatemodularruins.html)

**Medieval Village MegaKit** 的模块包括墙、楼板、楼梯与屋顶，完整系列超过 300 个；SOURCE 版本还包含特定引擎工程和碰撞配置。不要把 SOURCE 的碰撞配置等同于 Three.js 中已经存在的碰撞系统。[作者包页](https://quaternius.itch.io/medieval-village-megakit)

**Kenney Castle / Survival** 则适合先搭地标与营地原型。我的建议是让城门表示进入知识领域，让营地表示存档与回顾，让工作台表示组合知识，而不是只作为背景装饰。[Castle Kit](https://kenney.nl/assets/castle-kit) · [Survival Kit](https://kenney.nl/assets/survival-kit)

# 二、第二梯队：真正构成陆地世界的 Three.js 代码素材

## 6. IceCreamYou/THREE.Terrain：程序化地形

[GitHub](https://github.com/IceCreamYou/THREE.Terrain)

**MIT。**这是面向 Three.js 的程序化地形库。当前 README 列出了地形生成、过滤与平滑、混合地表材质、植被散布、草地以及带种子的随机数工具；也展示了实例化草地与距离细节控制。

适合借鉴的重点不是随机制造山，而是将可重复的地形生成接入你们的「问题即世界种子」。建议逻辑为：

```text
问题标识 + 世界生成版本
    → 稳定的区域布局与随机种子
    → 先确定出生点、知识入口和可走道路
    → 在通路周围生成山丘、坡地与谷地
    → 避开道路、入口和水面散布植被
```

以上语义布局需要自行实现，THREE.Terrain 本身并不理解知乎内容。道路连通性与地形装饰应分开处理，避免生成漂亮但无法到达目标的地图。

## 7. dgreenheck/ez-tree：程序化树木

[GitHub](https://github.com/dgreenheck/ez-tree) · [在线生成器](https://eztree.dev)

**MIT。**可调整树干、枝条与树叶等参数，支持种子，既可以作为库生成树，也可以在浏览器中导出 GLB / PNG。当前文档还提供多级细节 LOD 接口。

我建议先生成一小组树形，再复用它们。比如先做 6–12 种树形预设作为原型起点，而不是给每个关键词实时生成一棵独一无二、无法复用几何的树。树种与区域风格的对应关系由你们的设计配置决定。

## 8. MeshSurfaceSampler + InstancedMesh：把少量植被铺成森林

[MeshSurfaceSampler 官方文档](https://threejs.org/docs/pages/MeshSurfaceSampler.html) · [InstancedMesh 官方文档](https://threejs.org/docs/pages/InstancedMesh.html)

MeshSurfaceSampler 用于在网格表面采样；InstancedMesh 用于重复渲染共享几何与材质、但变换不同的对象，并减少绘制调用。这比把每一棵树、每一丛草都创建成独立对象更值得优先研究。

建议流程：采样地面位置 → 检查坡度与区域类型 → 排除道路、入口和水面 → 按地块批量实例化树、草、石头。排除规则与分块管理需要你们自行实现。

## 9. Three.js Sky / Water：天空与水面

[Sky 官方文档](https://threejs.org/docs/pages/Sky.html) · [Water 官方文档](https://threejs.org/docs/pages/Water.html)

Sky 提供天空穹顶；Water 提供平面反射水面。对于陆地场景，可用于湖泊、池塘、河流局部水面与远处天空。

**兼容性边界：**当前文档明确这些类面向 WebGLRenderer；WebGPURenderer 使用对应的 SkyMesh / WaterMesh 路线。不要混用不同渲染器的示例代码。

**功能边界：**Water 不是河道生成器、瀑布系统或流体模拟。河床、岸线、河流走向和通路设计仍需自己生成或建模。

## 10. drei / drei-vanilla：云、微粒、路标与传送入口

[pmndrs/drei](https://github.com/pmndrs/drei) · [pmndrs/drei-vanilla](https://github.com/pmndrs/drei-vanilla)

React Three Fiber 项目优先看 drei；原生 Three.js 项目看 drei-vanilla。后者仓库明确为 MIT，并列出 Cloud、Sparkles、Billboard、Trail、Outlines、MeshPortalMaterial 等功能。

我建议的陆地版用途为：

| 组件 | 项目中的用途建议 |
| --- | --- |
| Cloud | 山间云层、远景云团 |
| Sparkles | 萤火虫式提示、可收集知识的轻微闪光 |
| Billboard | 面向相机的关键词路标 |
| Trail | 探索轨迹与短时引导 |
| Outlines | 可交互物体的选中提示 |
| MeshPortalMaterial | 树洞、石门、遗迹入口 |

**文字需要单独留意：**drei-vanilla 的 Text 小节标为 EXTERNAL，指向 Troika 的文字渲染方案，不能据此假定包里存在可直接导入的同名 Text 类。[troika-three-text](https://github.com/protectwise/troika/tree/main/packages/troika-three-text)

# 三、让地面世界真正可走：移动、碰撞与寻路

这部分不是美术模型，但陆地方向的可玩性会依赖它们。以下方案按技术栈选择，不需要全部接入。

| 资源 | 已核实的功能与许可 | 建议使用场景 |
| --- | --- | --- |
| [PointerLockControls](https://threejs.org/docs/pages/PointerLockControls.html) | Three.js 官方第一人称视角控制；代码随 Three.js 许可 | 鼠标视角与第一人称输入的基础 |
| [Three.js FPS 示例](https://threejs.org/examples/games_fps.html) | 官方 Octree 碰撞示例 | 学习地面角色与场景碰撞的组织方式 |
| [gkjohnson/three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) | MIT；加速射线与空间查询，含玩家移动示例 | 地面命中、点击、遮挡检测与碰撞查询 |
| [pmndrs/ecctrl](https://github.com/pmndrs/ecctrl) | MIT；React Three Fiber + Rapier 的物理驱动控制器工具集 | 使用 R3F 的地面角色交互 |
| [donmccurdy/three-pathfinding](https://github.com/donmccurdy/three-pathfinding) | MIT；导航网格路径查询、多区域与移动约束 | 点击关键词后沿可走路线自动前往 |

PointerLockControls 不是完整物理系统；导航网格也不是视觉地形本身。建议分别维护：展示用网格、碰撞用简化几何、导航用可走区域，以及内容交互触发范围。

对于「点击关键词前往」：先求可达路径，再做角色或相机移动，不直接穿过山体插值到目标。

Three.js 主仓库许可：[MIT LICENSE](https://github.com/mrdoob/three.js/blob/dev/LICENSE)。主仓库代码许可不能自动代替示例中每个第三方模型、音频与纹理的具体许可。

# 四、地表材质与户外照明

## 11. Poly Haven：自然材质与户外 HDRI

[自然纹理入口](https://polyhaven.com/textures?origin=natural) · [户外 HDRI 入口](https://polyhaven.com/hdris?environment=outdoor) · [资产许可](https://polyhaven.com/license)

Poly Haven 的 HDRI、纹理和模型资产为 CC0。我建议优先搜索 grass、forest ground、rock、bark、dirt、moss 等类别，并从较小分辨率开始试用。HDRI 可作为照明与反射环境的来源，而不是强行让所有物体变成写实风格。

## 12. ambientCG：补齐地面与建筑表面

[站点](https://ambientcg.com/) · [许可说明](https://docs.ambientcg.com/license/)

ambientCG 下载资产采用 CC0。可以用来补齐石路、木板、泥地、岩壁等表面需求。我建议风格化场景先用克制的材质组合，不把高频写实贴图无差别覆盖到卡通模型上。

# 五、针对知乎陆地探索的素材映射建议

以下是设计建议，不是素材包或仓库自带的知乎功能。

| 知识探索元素 | 建议的陆地表达 | 首选资源方向 |
| --- | --- | --- |
| 一轮旅程的起始问题 | 出生营地 / 山谷入口 | Survival Kit 与自制问题牌 |
| 一个知识领域 | 一片有独特地标的林地或山谷 | Forest Nature、THREE.Terrain |
| 关键词与分叉选择 | 路标、岔路、小型地标 | Billboard、文字渲染与简单模型 |
| 回答或文章入口 | 遗迹、书屋、石碑旁的入口 | Modular Ruins / Village 模块 |
| 跨领域关联 | 桥梁、山口、连接道路 | Hexagon 道路地块或自建连续道路 |
| 探索存档 | 营地与旅程册 | Survival 风格道具与 UI |
| 知识行囊的组合 | 工作台、工坊或营火旁的合成位置 | 村落模块与自制交互物 |
| 个人画布 | 已探索地图、路径与地标记录 | 同一世界数据生成的地图视图 |

**不建议把所有文章全文悬浮在树林里。**我的建议是远处显示领域地标，中距离显示关键词，靠近并选中后才出现文章金句与来源链接。这样地形负责探索，文字负责理解，避免二者互相遮挡。

# 六、三套组合方案

## A. 森林山谷：最贴近第一人称漫游

主材选择 KayKit Forest Nature 或 Quaternius 自然包；地形选择 THREE.Terrain；天空与水面选择官方 Sky / Water；原生 Three.js 的移动先参考 PointerLockControls + 官方碰撞示例；R3F 项目可以评估 ecctrl。

建议先搭出一条能走通的体验路径：出生营地 → 林间岔路 → 两个知识入口 → 一个跨区连接 → 回到营地组合知识。先验证探索与阅读的关系，再扩充地图面积。

## B. 六边形知识大陆：最快做出可演示版本

主材选择 KayKit Medieval Hexagon，植被尽量保持同系列；关键词用 Billboard 与文字渲染；道路与地块扩展承担知识关系展示。

我会将其优先用于地图总览与快速原型。后续再把被选中的区域转换为第一人称连续地形，而不是一开始同时解决宏观地图与细节漫游。

## C. 遗迹档案馆：突出长文与知识沉淀

主材选择 Modular Ruins 或 Medieval Village；自然包只作为边界植被；Poly Haven / ambientCG 用于少量石材和木材；关键词路标和入口选中效果保持清晰。

让一座遗迹对应一组证据或一篇长文，让工作台对应跨文章组合。不要为了装饰而搭一个与知识内容完全无关的大城堡。

# 七、建议的接入优先级

| 优先级 | 先做什么 | 验收目标 |
| --- | --- | --- |
| S | 选择一个主素材生态，先挑少量模型 | 植被、建筑和路标的视觉风格一致 |
| S | 连续地面、出生点与碰撞 | 用户可以沿路径稳定行走 |
| S | 一个关键词路口和一个文章入口 | 点击、阅读、返回探索完整可用 |
| A | Sky、简单水面、适度阴影 | 形成基本陆地空间感 |
| A | 实例化植被与分块管理 | 增加密度时仍满足目标设备帧率 |
| A | 营地、存档和知识组合 | 行囊不仅是普通收藏夹 |
| B | 程序化树木、复杂云、精细水面与额外地貌 | 在核心体验稳定后增加变化 |

这不是承诺工时或性能指标；实际成本需要在目标浏览器与设备上测量。

# 八、资产目录与导入检查

建议的项目结构：

```text
assets/
├── models/
│   ├── vegetation/
│   ├── rocks/
│   ├── buildings/
│   ├── ruins/
│   ├── camp/
│   └── interactables/
├── terrain/
│   ├── presets/
│   └── tiles/
├── textures/
│   ├── ground/
│   ├── foliage/
│   └── water/
├── hdri/
├── licenses/
└── manifest.json
```

这里是项目内部组织建议，**不是建议将许可未明确的第三方原始素材公开镜像为独立素材库**。

建议每个条目记录：

```yaml
name: example_asset
source_url: "https://example.com/asset-page"
author: ""
license: "verified-license-id-or-text"
license_file: "licenses/example.txt"
retrieved_at: "2026-09-09"
source_version: ""
source_sha256: ""
original_format: ""
runtime_format: "glb"
triangle_count: null
material_count: null
texture_dimensions: []
collider: ""
notes: ""
```

导入时重点检查模型比例、轴向、底部原点、材质数量、贴图尺寸、透明叶片和碰撞几何。运行时模型通过 [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html) 加载；需要压缩时，要配好对应的解码支持。

可用 [glTF Transform CLI](https://gltf-transform.dev/cli) 的 `inspect` 和 `validate` 检查资产，再按实际瓶颈选择去重、减面、纹理缩放或压缩。不要盲目把所有模型使用同一套优化参数。

## 补充：公开仓库不等于明确许可的可复用资产

[dgreenheck/minecraft-threejs-clone](https://github.com/dgreenheck/minecraft-threejs-clone) 展示了程序化世界、生物群系、地形分块和存档等思路，适合学习。但本次仓库页面没有显示明确的许可证文件或许可说明，因此不将它列入可直接复制发布的主清单。借鉴其功能组织与确认代码、纹理的授权是两件不同的事。

# 最终建议

对于你们的第一人称知识探索项目，我会先做「一片森林、一条主路、几个知识入口、一个能组合知识的营地」，而不是先生成一整块巨大但空洞的大陆。

**主推荐：KayKit Forest Nature＋连续地形＋Three.js Sky / Water＋可靠的地面移动与碰撞。**

**快速原型备选：KayKit Medieval Hexagon＋关键词路标＋路径与存档。**
