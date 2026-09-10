"""Render the final report only after real acceptance evidence is complete."""
import json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/realistic-home';E=OUT/'evidence'
a=json.loads((E/'home-acceptance.json').read_text());assert a.get('status')=='passed' and a.get('soakSeconds',0)>=1200
asset=json.loads((E/'asset-budget.json').read_text());pkg=json.loads((E/'runtime-package.json').read_text());performance=a['performance'];initial=a['resourceBaseline'];final=a['resourceFinal'];transfer=sum(r['transferSize'] for r in a['startupTransfers']);decoded=sum(r['decodedBodySize'] for r in a['startupTransfers']);device=a['device']
text=f'''# 写实小屋实机报告 · 1.2.0-realistic-home

## 已实现

整屋的建筑、门窗、四设施陈设与壁炉/休憩区已重建。Poly Haven 真实模型、PBR 贴图、自制细木工与织物法线进入实际 GLB。Rapier 胶囊运动和独立相机球体扫掠用于小屋，主世界与文章场域保留。原收藏、锚点、旅程、手工合成、日志、电话未开放说明、暂停输入隔离和键位保持。

## 实际验证

- 本轮旧版截图及相机：before.png / before.json。
- 阅读角：3 项真实浏览器检查；实际纹理/阴影/中文，键盘移动、跳跃与打开原收藏面板。
- 最终 GLB：glTF Transform 4.5.0 validate **0 错误、0 警告**；{asset['visualTriangles']:,} 可见资产三角面、{asset['colliders']} 个简化碰撞代理、5 个白名单设施标记。
- 引擎/存储/交互/物理：22 项；当前 GLB/连通性/边界：6 项；后端：21 项通过。
- 故障检查：6 项通过，覆盖 GLB 503、缺失贴图、实际 WebGL context loss、迟到加载、旧落点安全恢复和销毁。
- 补充空间检查：16 个无家具占据的贴墙镜头角度、实际 W 行走进入电话亭门口并点击原说明面板。
- 完整业务链：{len(a['checks'])} 项记录，通过五个设施、中文输入隔离、真实路线、原文收藏去重、文章场域、锚点、两材料手工合成与洞察保存、回家刷新。
- 持续运行：**{a['soakSeconds']:.2f} 秒**；10 次真实业务家园/世界往返。另有独立引擎 10 次往返及取消测试。
- 解压包：使用 Python 启动，PATH 中没有 Node.js/Blender，真实浏览器进入完整小屋并操作电话面板。运行包所有源码字节和清单哈希均复核。

## 实测性能与条件

设备：{device['platform']}；GPU：{device['gpu']}。
浏览器：Chrome {a['browser']}，{'有界面' if device['headed'] else '无界面'}，视口 1920×1080，DPR 1，中画质；本地 HTTP、全新浏览器上下文，未清空操作系统文件缓存。非限速公网冷启动。开发期间有短时独立浏览器故障/打包检查，未宣称独占 GPU。

| 指标 | 实测 | 边界 |
|---|---:|---|
| 初次导航到 ready/首帧 | {a['coldSecondsToReadyAndFirstRender']:.2f} 秒 | 本机 HTTP 条件；不能代表所有公网网络 |
| 首屏子资源 transferSize 合计 | {transfer:,} 字节 | Resource Timing，不含主文档；并非全站资源总和 |
| 子资源 decodedBodySize 合计 | {decoded:,} 字节 | 保留原始清单，不混作压缩体积 |
| GLB 文件 | {asset['bytes']:,} 字节 | gzip 计算值 {asset['gzipBytes']:,} 字节，不声称服务器已启用 gzip |
| 中位 FPS | {performance['medianFps']:.2f} | {performance['sampleCount']:,} 个真实原始可见帧样本 |
| P95 帧时间 | {performance['p95ms']:.2f} ms | 包含切场，未使用截断的物理 dt |
| 低画质 | 中位 {a['lowQuality'].get('medianFps')} FPS / P95 {a['lowQuality'].get('p95ms')} ms | 短时 5 秒采样，非低画质 20 分钟 |
| 初始/结束 GPU geometry | {initial['geometries']} / {final['geometries']} | 预热后有一次分配变化，未观察到持续逐轮增长；不等于证明不存在任何泄漏 |
| 初始/结束 GPU texture | {initial['textures']} / {final['textures']} | 原始计数保留 |
| 初始/结束 program | {initial['programs']} / {final['programs']} | 原始计数保留 |

本机 HTTP 未启用资源传输压缩；子资源实际传输约 15.15 MB，略超十进制 15 MB。**压缩后完整首屏 ≤15 MB 未经验证**，单个 GLB 的 gzip 计算值不能代替全链路验收。

绘制次数在部分全屋视角超过 150（循环记录也出现 151–153）。**“所有视角 ≤150 draw calls”没有达标**，不以出生视角替代全屋验收。典型出生渲染约 15.5 万三角面（含阴影），具体记录见原始证据。

## 未验证或受限

- 没有再次公网部署或 push；已有公网仍是 1.1.1-roaming，本地为本轮 1.2.0。
- 未测 Safari、Firefox、Windows、低端 GPU 和移动触屏漫游；没有全网络条件的 8 秒承诺。
- 没有真实知乎/付费模型调用。本轮验收使用明确标记的原创演示路线和手工模式。
- 角色与主世界保留旧风格；自制植物、电话和部分陈设仍有风格化处理，不宣称全屋达到摄影级或商业 3A 资产质量。
- Blender MCP / Chrome DevTools MCP 未连接；实际使用 Blender 5.2.1 Python 与 Playwright/Chrome CDP；引用的自定义质量 Skill ZIP 未提供。
- Rapier 上游兼容包初始化会打印一条弃用参数警告；测试中无未捕获页面 JavaScript 异常。

## 交付

运行 ZIP：{Path(pkg['file']).name}，{pkg['bytes']:,} 字节，SHA-256 `{pkg['sha256']}`。完整 Blender 源场景、制作脚本、原资产、许可、备份和证据在配套工程目录。

截图见 GALLERY.md；完整业务与性能数据 home-acceptance.json、raw-frames.json.gz；异常处理 failure-checks.json；补充空间 spatial-checks.json；包验证 package-checks.json；每项数据的作用范围分别保留，未以离屏或模拟结果冒充浏览器验收。
'''
(OUT/'TEST_REPORT.md').write_text(text)
print('Report written from completed browser evidence')
