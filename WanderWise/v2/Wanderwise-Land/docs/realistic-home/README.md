# 漫知录 · 写实知识书房（1.2.0-realistic-home）

本轮重建整个家园小屋，采用 Poly Haven 写实家具、Blender 定制建筑、Three.js PBR 与 Rapier。仍为同一个连通空间：收纳柜、合成工作台、窗边日志、电话亭和出发大门连接原业务。

## 启动

在项目目录运行：

```bash
python3 start.py
```

原 Windows `start.bat`、macOS `start.command` 同样保留。最终运行文件、Three.js、Rapier WASM 与 GLB 已在前端目录中，使用者不需要 Node.js 或 Blender。首次 Python 依赖安装仍需联网。

本轮验收服务使用 `http://127.0.0.1:18093/home` 和独立测试数据库。已有旧 Python 进程需重启才能加载新的 WASM CSP 头；不要只刷新旧进程页面。标准启动继续使用原配置和原数据库，不清理数据。

- WASD 移动、鼠标转镜头、空格跳跃，靠近设施左键打开。
- E 收藏、F 进入文章场域、B 行囊、R 想法、T 锚点、V 导航、Esc 暂停保持。
- 按用户上一轮要求，不恢复准星或简化阅读模式；图形故障提供重试和低画质重试。
- 电话亭继续显示真实“未开放”；本轮未调用知乎或付费模型接口。

运行包：项目上级 `Wanderwise_Realistic_Home_Runtime_20260910.zip`（约 8.1 MB）；原始资产与 Blender 源场景留在本工程。

## 交付位置

- `frontend/assets/home/home-realistic-full.glb`、`scene.json`：实际运行资产和配置。
- `assets-source/home-realistic-full.blend`：可编辑源场景，图片已打包。
- `tools/build-realistic-home.py`、`tools/optimize-realistic-home.mjs`：可复现建模和优化。
- [源码审计](SOURCE_AUDIT.md)、[资产及许可](ASSETS.md)、[渲染与物理](MIGRATION.md)、[真实图集](GALLERY.md)、[测试报告](TEST_REPORT.md)。

## 升级与回滚

先关闭旧服务，再覆盖应用源码并使用原启动命令。保留原 `.env`、数据库、备份目录和服务端持久卷。不要解压覆盖或删除用户数据。家具布局变化时，只有被新碰撞体占据的旧角色落点会被调整到安全出生点，收藏与业务 ID 不变。

完整基线归档是项目上级的 `rollback-before-realistic-home.tar`；SHA-256 和基线提交见 `BASELINE.json`。推荐将归档解压到**独立空目录**，定位其中的 `WanderWise/v2/Wanderwise-Land` 后运行，以便先确认旧版；若需要接回原存档，停服并保留原数据路径。不要使用 `git reset --hard` 或清理数据来回滚。

已有 `?renderer=legacy` 仍为互斥旧渲染入口，但完整视觉/代码回滚以基线包为准。新代码没有后台运行第二个渲染器或 RAF。

本版本包含本地工程和预构建文件，源码交付分支为 `v2`；未再次公网部署，现有公网仍是 1.1.1-roaming。
