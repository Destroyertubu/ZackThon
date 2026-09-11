# 启动、升级与回滚

这是本地升级版；既有 Netlify 地址仍是上一轮已部署版本。本轮未购买素材、未调用知乎或付费模型、未修改公网部署。

## 启动

安装 Python 3.11+，解压工程包，进入 Wanderwise-Land 目录运行：

```bash
python3 start.py
```

Windows 可双击 start.bat。首次安装 Python 依赖需网络，安装后演示路线、同源 Three 库、模型和纹理可以离线运行。不需要 Node.js 或 Blender。打开 http://127.0.0.1:8000/home 。不要直接双击 HTML。当前 1.1.1-roaming 已删除简化模式，旧 ?mode=2d 链接会回到三维体验。

进入漫游后 WASD 移动、空格跳跃、鼠标视角、左键激活约 3 米内设施、Esc 暂停。若浏览器拒绝指针锁定，可右键拖动视角。各设施也可从原菜单打开。

## 原地升级

先停止自己启动的旧服务并备份整个旧目录。保留现有 data、backups、.env、.venv 与云平台环境变量；不要从新包覆盖或清空这些目录/配置。新包不含用户数据库或密钥。Python 后端与存储协议未改，可把新版 frontend 目录整体替换进旧项目（先将旧 frontend 重命名留存），然后重新启动原 Python 服务。不要把测试数据库复制成真实存档。

新版模型/库在 frontend 中预制齐全。浏览器刷新后加载新版本；存档仍由原访客身份管理，不变更 ID。跨域/换端口会产生不同浏览器身份，不应据此判定存档丢失。Netlify 如需升级，应另行确认后部署，不能仅拖拽前端当成完整后端部署。

## 快速互斥回滚

在同一来源打开 http://127.0.0.1:8000/home?renderer=legacy 使用原 WebGL2 渲染；参数随路由与刷新保留，不与 Three 后台并行。不带参数重新打开即可返回新版。

若需完整恢复源码，在单独目录解压 rollback/pre-home-source.tar.gz，再使用原配置和数据。该归档是仓库根结构，不直接覆盖正在运行的目录；项目位于 WanderWise/v2/Wanderwise-Land。源码基线为 93e8ee6499274e63df9a7a0e363b530a58da9510，归档 SHA-256：

`57ac398506de11aca3028f0374094189504351be6d9be6a4966f7be3e0ed3e86`

本地原备份位于工程旁 ../rollback-before-home-upgrade/；分发包附同一源码归档。源码备份不含数据库，不能代替用户数据备份。

## 开发者重建（最终用户无需执行）

Three 固定 0.186.0：npm ci 后 npm run vendor:three。Blender 5.2.1 LTS 执行：

```bash
blender --background --python tools/build-home-blender.py -- corner
blender --background --python tools/build-home-blender.py -- full
```

源 .blend 已内嵌纹理；assets-source/kaykit-furniture 保留所选原文件及许可。脚本确定布局与几何，跨 Blender 版本不承诺二进制哈希相同。npm run build 只检查模块语法；npm run build:cloud 只生成本地 dist，不部署。tools/package-home.py 生成排除密钥/数据/依赖的运行包及 SHA 清单。

本轮验收使用独立 /private/tmp/wanderwise-home-upgrade-20260909.sqlite3、独立 Chrome 身份、127.0.0.1:18091，没有读取生产存档。测试报告记录实测条件，旧 docs/cloud-deployment-status.json 与 MANIFEST.cloud.json 是上一轮部署记录，不代表本轮发布。
