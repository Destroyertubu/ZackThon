> **当前本地版本 1.2.0-realistic-home：** Poly Haven 写实家具/PBR、Blender 重建小屋、Rapier 胶囊移动与独立相机避障。保留原业务与 Python 启动。见 [本轮交付、启动及回滚](docs/realistic-home/README.md)、[实机图集](docs/realistic-home/GALLERY.md)。本轮尚未发布到公网，现有公网仍为上轮版本。

> **历史公网版本 1.1.1-roaming：** 已删除简化阅读模式与准星；靠近金句直接左键打开原文，主题扩展原地更新，远近文字分层并避让。见 [本轮修改与验证](docs/roaming-update/README.md)。已发布到 [公网体验](https://wanderwise-land-v2-lostmagician155.netlify.app/home)，见 [发布验证](docs/roaming-update/PUBLIC_DEPLOYMENT.json)。下面的家园历史报告保留原测试范围。

> **历史本地版本：1.1.0-home.1 · 林间灯火知识书屋。** Three.js + Blender GLB 家园升级，保留原业务与 Python 启动。见 [启动/升级/回滚](docs/home-upgrade/RUN_UPGRADE_ROLLBACK.md)、[本轮验收报告](docs/home-upgrade/TEST_REPORT.md)、[资产许可](docs/home-upgrade/ASSETS.md)、[渲染迁移](docs/home-upgrade/RENDERING_MIGRATION.md)。本轮尚未部署到公网；下面的云端状态属于上一轮版本。

> **Netlify 云端适配：** 本次新增可部署后端与持久存储。见 [Netlify 部署说明](docs/NETLIFY_DEPLOYMENT.md) 和 [实际部署状态](docs/cloud-deployment-status.json)。下文保留原始本地包说明。

---
title: "漫知录 Wanderwise · 陆地运行版"
version: "1.0.0-land"
date: 2026-09-09
language: zh-CN
---

# 漫知录 · Wanderwise Land

带着一个问题出发，在森林、旷野、湖畔和遗迹之间读到观点，把摘录与私人思考带回小屋，再建立自己的知识联系。

**这是带后端持久化的可启动工程，不是静态页面。当前交付是本地运行版，不等于需求书全部 P0 已验收。** 默认自带 12 篇原创演示短文、3 条演示路线；界面始终标记“原创演示 · 非知乎数据”。真实知乎适配器已编写并通过模拟响应契约测试，但本次没有完成真实 API 联调，没有把演示内容冒充真实知乎内容。

## 30 秒找到启动入口

需要已安装 **Python 3.11+**。原包实测 Python 3.13.5；本轮实测 Python 3.12.13。首次安装 Python 依赖需要能访问 Python 软件源；依赖装好后，自带演示路线无需外网。前端库和模型已随包预制，最终用户不需要 Node.js 或前端构建；开发重建使用 package.json 中的依赖。

| 系统 | 启动方式 |
| --- | --- |
| Windows | 解压后双击 `start.bat`；也可在目录中执行 `py -3 start.py` |
| macOS | 终端进入解压目录，执行 `python3 start.py`；允许执行时也可打开 `start.command` |
| Linux | `python3 start.py` 或 `bash start.sh` |

```bash
python3 start.py
```

脚本创建项目内 `.venv`，安装 `requirements.txt`，启动服务并尝试打开浏览器。浏览器地址：

```text
http://127.0.0.1:8000
```

Windows 的命令行也可将 `python3` 换为 `py -3`。不要直接双击 `frontend/index.html`：文件协议没有后端、Cookie 会话与 API。

已自行准备 Python 依赖的环境可跳过安装与自动打开浏览器：

```bash
python3 -m pip install -r requirements.txt
python3 start.py --use-current --no-install --no-browser
```

默认只监听本机。更改端口：`python3 start.py --port 8080`。终端显示启动地址后，使用支持 WebGL2 的浏览器打开。触屏、窄窗口和旧偏好不会切换阅读模式；图形初始化失败时显示明确错误，提供重试与低画质重试。

## 第一条可以操作的闭环

进入小屋 → 下方“大门 / 起程” → 选一条“原创演示”路线 → 靠近话题并阅读 → 收集至少两份摘录 → 留下私人想法 → 进入正文场域并返回 → 保存回家 → 收纳柜选中两份材料 → 送往合成台 → 手工写下联系并保存 → 日志查看洞察与旅程星图。

没有开发者凭证时，合成台默认是**手工联系**，不是伪装成 AI 的固定生成文案。AI 模式须另行选择，并真正请求服务端提供器；失败会保留选材，不生成假成功结果。

### 3D 操作

点击“进入漫游”后才捕获鼠标。WASD 相对相机移动；Space 跳跃；鼠标转动镜头；滚轮缩放；Esc 解锁或暂停。E 收集，F 进入有正文的文章场域，B 行囊，R 创建私人锚点，T 查看自己的锚点，V 在微风、光带、关闭间切换。V 不自动移动角色。

阅读、行囊与编辑面板打开后暂停移动；中文输入和输入框中的游戏快捷键不生效。必要操作都有屏幕按钮。靠近金句约 4 米内，左键直接打开最近一条对应原文，无需瞄准；墙体仍会阻挡交互。靠近主题的后台扩展不退出漫游。

## 实际包含什么

| 模块 | 交付内容 |
| --- | --- |
| 家园与陆地 | 单个连通小屋、四设施、大门；程序化低模森林/旷野/湖畔/遗迹、道路、角色；不是下载的 KayKit 模型 |
| 漫游系统 | 原生 WebGL2、第三人称相机、简化碰撞/重力/跳跃、镜头障碍探测、浮动 SDF 文字、距离分层、V 导航 |
| 世界与内容 | 问题起程、确定性布局、冻结旧坐标的扩展、来源阅读器、摘要/正文区分、按段落定位的规则结构场域 |
| 个人知识 | 唯一收藏库、备注/标签、手工连线、私人锚点 CRUD、2–4 材料合成、洞察保存与来源引用 |
| 存档 | 服务端 SQLite、暂停/继续/归档、检查点、场域返回上下文、语义事件星图、删除个人数据 |
| 接口与安全 | 同源 HttpOnly 访客会话、CSRF/Origin 检查、所有权校验、幂等、版本冲突、标签页租约、任务表、预算和缓存 |
| 开发交付 | 启动脚本、Docker/Caddy 配置、OpenAPI、自动测试、API 核验工具、备份工具、素材与技术差异说明 |

电话亭目前显示真实未开放状态。OAuth、公开锚点、评论、同频匹配、聊天、公共行囊、热榜/故事路线未实现，不展示假用户或假社交数据。

## 配置真实知乎能力

**交付包不包含任何实际 API key，也不会在前端读取 `VITE_*` 等密钥。** 本轮聊天提供的 key 没有在网络成功请求中得到验证，建议正式上线前在平台轮换。

在终端运行：

```bash
python3 start.py --live
```

按提示粘贴 Access Secret。输入不会回显，也不会写入 `.env`，只进入当前服务器进程环境。服务检测到配置不代表已证明凭证有效。公开部署请使用托管平台 Secret 或挂载的 Secret 文件，并设置 `ZHIHU_ACCESS_SECRET` 或 `ZHIHU_ACCESS_SECRET_FILE`。**不要**把真实值写入仓库、前端、截图、提交说明或共享压缩包。

启用后可使用自由问题搜索，或打开官方“知乎知识目录”选一篇正文。目录/正文按所给规格不添加 Access Secret；搜索与直答只在对应固定域名发送凭证。

### 先补齐真实核验，再称为知乎接入完成

停止应用，使用项目 Python 执行：

```bash
# macOS/Linux：安装依赖后使用项目虚拟环境
.venv/bin/python tools/download_official_skill.py
.venv/bin/python tools/verify_zhihu.py --prompt-key --search "如何培养学习能力" --first-work

# Windows 对应解释器：.venv\Scripts\python.exe
```

下载器使用用户提供的精确官方 ZIP 地址，检查解压路径和大小，但不自动执行下载脚本。核验工具最多执行一条搜索、一次目录和一个详情（缓存命中时更少），**不发布内容、不调用 AI、不批量抓取**。成功的真实路线写入服务端缓存，下次启动显示真实来源和获取时间。第一个知识条目不一定适合论述场域，应根据实际 `canEnterField` 再选适配材料。

详情见 [接口核验说明](docs/API_VERIFICATION.md)。下载器和适配器在本次环境未取得官方在线数据，不能把随包说明称为已读到官方 Skill 的替代品。

## 存档在哪里

默认：`data/wanderwise.sqlite3`，首次启动创建。该目录包含应用访客数据，不在交付包内。数据库依靠浏览器 Cookie 识别访客；清除 Cookie 后不保证找回原账户。连续 30 天未活跃的访客记录可被清理。保存中的离线操作和草稿使用 IndexedDB；**不提供断网后的全站冷启动保证**，也没有离线 Service Worker。

只运行一个后端实例和一个 worker。不要让多个实例共享 SQLite，也不要部署到无持久卷的临时文件系统。

```bash
.venv/bin/python tools/backup.py backups/wanderwise-backup.sqlite3
```

备份使用 SQLite 在线备份 API，不直接复制活跃 WAL 主文件。备份包含私人记录，请勿公开。

## 测试和当前边界

本轮已执行：**21 项后端测试、10 项引擎纯逻辑测试、7 个前端 ES Module 语法检查**；受限浏览器中的 2D DOM/API 联调走通 11 个核心步骤；独立 EGL/GLES3 检查编译链接了项目实际四个着色器并渲染场景几何。完整记录在 [测试报告](docs/TEST_REPORT.md)。

受限浏览器测试使用进程内 HTTP 桥接及存储替身，**不是**真实浏览器网络、Cookie、CSP、IndexedDB 验收。独立 GLES3 渲染也**不是**浏览器 WebGL/鼠标锁定/中文 SDF/碰撞实机验收。

尚未完成：真实知乎接口与真实 AI 联调；至少一条真实知乎缓存路线与适配正文场域；公网 HTTPS；桌面 3D 操作、性能/长期运行和三位新用户验收；完整离线/多标签页浏览器故障验证。这些是 [需求追踪表](docs/REQUIREMENTS_TRACEABILITY.md) 中明确的未验收项。因此**不将本包标成已通过全部 P0 或正式参赛生产验收**。

本版技术栈为原生 ES Modules/WebGL2 + FastAPI/Pydantic + SQLite，不是需求书建议的 React/R3F/Rapier/SQLAlchemy/Alembic 组合；规则结构导览不冒充 AI 论证分析。差异与代价见 [技术决策](docs/TECH_DECISIONS.md)。

## 开发检查

```bash
python3 -m pip install -r requirements-dev.txt
python3 -m pytest -q tests/test_backend.py
node tools/check_frontend.mjs
node --test tests/test_engine.mjs
```

Node 只用于开发检查，不参与启动或部署。`frontend/` 本身就是可直接分发的前端产物，不需要 `npm install` 或 CDN。

真实浏览器验收脚本另附 `tests/browser_e2e.py`：先启动服务器，再安装 Playwright 浏览器后运行。它在本轮受限环境未被标成通过。

```bash
python3 -m playwright install chromium
python3 tests/browser_e2e.py --base-url http://127.0.0.1:8000
python3 tests/browser_e2e.py --base-url http://127.0.0.1:8000 --require-3d --headed
```

## 文档导航

[体验脚本](docs/DEMO_GUIDE.md) · [部署与恢复](docs/DEPLOYMENT.md) · [接口核验](docs/API_VERIFICATION.md) · [架构及技术差异](docs/TECH_DECISIONS.md) · [测试记录](docs/TEST_REPORT.md) · [需求追踪](docs/REQUIREMENTS_TRACEABILITY.md) · [素材许可](ASSET_LICENSES.md) · [OpenAPI](contracts/openapi.json)
