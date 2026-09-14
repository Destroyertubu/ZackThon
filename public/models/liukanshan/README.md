# 刘看山立体角色

`liukanshan.glb` 是依据用户提供的三视图与动作 GIF 独立重建的立体模型。白身体、大黑鼻子、黑手脚、柔和双耳和短圆尾均为真实网格；不是图片面片，也没有使用 GIF 作为运行时外观。

**来源不是 CC0。** 用户将 `看山三视图.zip` 与 `刘看山动态.zip` 提供为官方角色参考。原角色设计、三视图和动作图像的权利属于其原权利人。本项目保留用户提供的素材来源，不把改建模型或原素材误标为开源授权，也不声称模型是官方发布的 3D 文件。

## 运行规格

- 运行文件：`/models/liukanshan/liukanshan.glb`。
- 高约 **0.8225 m**，站立地面 Y≈0，正面朝 **+Z**。含双臂宽约 0.521 m，含鼻尾深约 0.582 m。
- **48,589 三角面**（包括电脑），约 **1.31 MB**；具体字节数和 SHA256 见 `asset-report.json`。
- 16 个网格，其中电脑的实体键帽已按材质合并；电脑隐藏时仅绘制角色网格。
- 使用 glTF 标准 PBR 材质，没有外部纹理、网络素材依赖或几何解码器。
- 白色主体采用连续截面塑形，口鼻属于同一主体曲面；耳根经体素融合和光顺。手指、眼睛、脚掌、短尾及电脑都有体积。

## 组件

```tsx
import Liukanshan from '@/components/home/mascot/Liukanshan'

<Liukanshan
  position={[x, floorY, z]}
  rotation={[0, yaw, 0]}
  state="idle"
  animated={!reducedMotion}
/>
```

| state | 行为 |
| --- | --- |
| `idle` | 轻微呼吸、自然眨眼、短尾小幅活动 |
| `greeting` | 抬手并轻轻挥手 |
| `searching` | 坐下使用立体电脑，双手交替打字 |
| `reading` | 陪伴用户阅读时安静打盹，闭眼、轻微点头 |
| `collected` | 两次轻点头，1.8 秒后回到平静状态 |

动作由 `liukanshanAnimation.ts` 采样，再驱动 GLB 命名关节；GLB 本身没有嵌入动画片段。状态切换平滑过渡，`animated={false}` 立即应用固定姿态，并关闭眨眼、呼吸和所有周期运动。组件没有全局事件监听、计时器或应用状态依赖。

关键节点：`liukanshan_root`、`body_joint`、`arm_L_joint`、`arm_R_joint`、`forearm_L_joint`、`forearm_R_joint`、`leg_L_joint`、`leg_R_joint`、`eye_L_joint`、`eye_R_joint`、`tail_joint`、`mascot_laptop`。`laptop_lid` 保留为可编辑的静态铰链节点。

组件克隆节点与材质，仅释放自己的材质克隆，保留加载器缓存的模型几何。模型启用投影和接收阴影，需使用场景现有的照明及可接收阴影的地面。站立放置时可预留约 0.34 m 的平面半径；挥手是上半身动作，电脑在角色前方约 0.25 m。

## 编辑与复现

可编辑源：`assets/source/liukanshan/liukanshan.blend`。其中保存命名关节、PBR 材质与柔光验收摄影棚；电脑默认不参与静态摄影棚渲染。

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/build-liukanshan.py
```

该命令生成 GLB、可编辑 Blend、统计 JSON，以及 `assets/source/liukanshan/renders/` 中的 `front.png`、`side.png`、`back.png` 和 `hero.png`。只需模型时在命令末尾加 `-- --no-render`。

开发服务器上可访问 `/assets/source/liukanshan/preview.html`，用实际组件切换五种动作并拖动查看 360°。独立网页检查脚本为 `assets/source/liukanshan/check-runtime.mjs`，验收报告记录在同目录的 `runtime-report.json`。五种 `animated=false` 状态都比较了两个时刻的 12 个动态节点：位置、旋转、缩放、可见性完全不变。
