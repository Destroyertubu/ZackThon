# 无框文字：A / B / C / D 实施记录

日期：2026-09-13。工作目录为 Kimi_Agent_小屋真实感建模/app，沿用 v4 上已有的未提交功能。修改前 src 快照：artifacts/diegetic-typography/baseline/src-before.tgz。效果图是设计方向，runtime/ 中为实际运行截图。

## 实际接入

| 方案 | 运行时行为 | 主要实现 |
| --- | --- | --- |
| A 星尘航标 | 星门、调酒角、回家门使用透明字形与成批 GPU 粒子；靠近聚拢，贴近镜头时淡出；地面光路流动。按钮保持可访问名称。 | SpatialWords、StarlightPath |
| B 材质印记 | 收藏文字贴在柜面，合成文字贴在桌面；桌面焦散连续变形。小屋其他入口保留空间定位与 E 交互。 | Experience、MaterialCaustics |
| C 酒液诗篇 | 两种原料改变实际三维酒杯的颜色和比例；液面波动、流光、雾气与星芒；调制时杯中展开目的地真实路线布局的简化缩景；沿用取消、重试和自动进入对应旅程。 | CocktailVision、RealmInGlass、GardenWorkshop |
| D 湖畔读境 | 资料静读为无底板 DOM 正文，当前段落提亮，可选取复制，保留作者、来源、摘要/导引标识；段落位置可恢复，收藏使用同一份个人数据。阅读时停止移动，环境仍运行。 | ReadingLight、SourceCard、WorldCanvas |

主标题复用已有 StellarText 的字形动画，没有另起 WebGL 渲染器。场景字形采用透明 CanvasTexture 和单批 Points；长正文采用原生排版。原生输入、下拉选择、快捷键、焦点和关闭语义仍有效。弹层以整幅环境暗化提高可读性，去掉有边界的卡片底板与边框。

本次三张新增外部贴图共约 147 KiB；来源、许可证与校验值见 public/textures/typography/SOURCES.md 和 manifest.json。场景、液体、粒子 shader 为项目代码，不是网络素材包中的复制代码。

## 验证记录

- 配方：test:garden 通过，覆盖十种命名组合与比例。
- 视角：test:look 通过，覆盖自然鼠标、模态输入暂停、Esc / F、触屏清理。
- 小屋：test:home 通过，3613 个地面采样、七处交互及相机契约。
- 观星台：test:observatory 通过，23015 个连通站立采样、15 次往返与入口检查。
- 旅程：test:journeys 通过，十种组合、五处停靠、六份来源以及 1104 项导航/几何检查；保留既有素材检查。
- 个人数据：test:personal 29 项通过，包括共享收藏、取消收藏保留笔记、迁移与导入导出。
- 浏览器实际完成：调酒取消后配方保留；重试自动进入落日大道；资料收藏；静读从第一段推进到第二段；关闭重开恢复第二段；Esc 只关闭静读并把焦点还给入口；星系展开后返回同一个旅程实例及“看见一束光”停靠点。
- 视口：390×844 手机布局、1280×720 桌面布局。手机静读长英文标题换行；调酒纵向滚动，控件没有横向溢出。
- 检查时修复：嵌套静读的 z-index、弹层挂载后才绑定滚动恢复、近距离空间按钮被放大、调酒背景误模糊、手机酒杯与标题重叠。

最终 npm run build 与本轮新增组件及页面/相机的定向 ESLint 检查通过。浏览器没有 error 级日志；保留 Three.js Clock / PCFSoftShadowMap 的既有弃用提示。Vite 仍提示主包偏大，本轮未进行主包拆分。

已发布到 RTX-PRO-6000 的现有服务，298 个源码与构建文件 SHA-256 一致。旧 dist 与源码备份位于服务器 artifacts/deploy-backups/typography-20260913-2235/。公网 /observatory、/home、旅程直接路由及新增贴图/主 JS 均按本轮 release 校验。发布未重启隧道，也未改写数据库、认证配置或浏览器数据卷。普通入口为 https://eau-recorded-gap-decor.trycloudflare.com/observatory；已打开的网页需要刷新加载新版。

## 参考台账

使用 /Users/gauss/.agents/skills/threejs-game-ui-designer/SKILL.md 与 /Users/gauss/.agents/skills/3d-web-experience/SKILL.md。

- ui-patterns.md：保留完整入口、焦点和游戏输入语义；根据用户要求取消视觉框体。
- checklists/game-ui-quality.md：对比场景、调酒、静读、取消、返回状态。
- checklists/hud-readability.md：稳定正文与场景短字分开实现；近距离与明暗背景检查。
- checklists/responsive-ui-fit.md：手机与桌面两档实际截图验证。
- checklists/mobile-input.md：44px 主要触控目标、原生中文输入与滚动区域。

## 本轮范围

这是实时可交互的首版落地，不宣称与概念图的材质和布景一比一。杯中缩景读取十个世界的路线与停靠点，采用简化几何；没有在杯中再加载完整世界。减少动态效果的系统偏好会停止新增粒子/液面循环和文字过渡。本轮未重新进行 GPU 帧率基准测试，不能把原有 31–42 FPS 的观测值当成本版性能结果。
