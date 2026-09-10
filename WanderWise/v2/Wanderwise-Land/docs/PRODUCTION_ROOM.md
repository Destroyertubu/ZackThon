# 林间灯火 · 新房间施工版

工程：独立 worktree `codex/wanderwise-production-room`，基线 `2c80d9bf`。使用制作包冻结的 WW-HOME-GOLDEN-01 布局。实际完成状态以 `reports/production-acceptance` 和 `10_execution/status.json` 为准，不继承旧版性能或接口验收。

## 启动

在此工程目录执行 `python3 start.py`，Windows 可双击原 `start.bat`。前端模块、GLB、纹理、Three.js、Rapier WASM 和 Meshopt 解码器全部随包同源提供。最终用户不需要 Node.js 或 Blender。默认地址由原启动器显示。

本次开发预览位于 `http://127.0.0.1:18095/home`，运行的是独立临时测试存档。原开发工程和原存档未迁移、未清空。

## 保留的功能

原第三人称控制、WASD、Space、视角、暂停、输入隔离、近距离左键阅读、主世界、文章场域、收藏、锚点、旅程和手工合成保持现有业务。门/柜/台/日志/电话分别映射 `seed/bag/synthesis/journal/phone`。电话亭继续显示未开放。按照此前明确要求，不恢复简化阅读模式或准星。

## 模型与制作

源码 `tools/build-production-room.py` 调用按资产分工的 `production-*.py`；统一参数在 `design/home`。Blender 5.2.1 LTS 运行：

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 --python tools/build-production-room.py -- full
node tools/optimize-production.mjs full
```

开发时才需要 Blender 与 Node。`assets-source/room-production/full.blend` 保存可编辑的分件模型；运行 GLB 仅合并同一资产根下的静态可见部件，碰撞、socket、出生点和设施语义保留。离线65帧布模拟导出静态布网格，不增加运行时物理或RAF。远山和林谷是固定几何，不是参考图贴幕。

优化顺序是 inspect → dedup → weld → tangents → JPEG87 → Meshopt medium（位置和UV16位）→ validate。几何压缩解码器为 Meshoptimizer 1.2.0，MIT 许可附在 `frontend/vendor/meshoptimizer/LICENSE.md`。压缩前源 GLB 和逐步输出保留；没有一键平铺整个场景、裁掉功能节点或用高精度模型直接全量发布。

## 渲染与碰撞

保持一个活动 Canvas、Three 渲染器与动画循环。DOM、API和数据库不迁移。GLTFLoader管理颜色/数据贴图语义，中文由CanvasTexture创建。场景切换带取消/迟到结果销毁，资源失败显示原重试入口。

房间COL区分 player/camera/interaction。相机沿用Rapier球形扫掠并在平滑后复检。圆形合成台的代理拆为16条窄盒组合，避免用整张方盒阻挡圆桌四角。玻璃只按配置参与角色阻挡，不遮挡设施交互和镜头。人物仍采用现有1.5米视觉/胶囊契约；与制作包1.72米目标的差异未默默改写。

默认一盏投影主光，其余低成本补光。无Bloom、DOF或运行时反射相机。当前环境反射为自制低分辨率PMREM近似，不冒称已经烘焙GI或AO。远景使用延伸远裁面和远雾，室内墙顶仍完整。

localhost `?qa=1` 才提供固定摄影机；CAM07摄影剖切只在此模式隐藏顶板/屋架并裁切近墙。进入正常漫游即复原，不影响正式墙体或碰撞。

## 回滚

此 worktree 本身隔离原版。可在 localhost 打开 `/home?room=legacy` 对照上一版小屋；永久回滚仅将 `frontend/assets/home/scene.previous.json` 复制到 `scene.json`，无需触碰存档或数据库。原Git基线和制作前归档另有记录于 `reports/G00_baseline/baseline.json`。

升级时覆盖源码和运行资产，不覆盖 `.env`、用户数据目录或SQLite文件。当前任务没有公网部署、push、购买或读取密钥。真实知乎/AI/线上HTTPS验收缺口仍按原文档处理。
