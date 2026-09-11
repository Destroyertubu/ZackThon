# 漫游交互修订 · 1.1.1-roaming

本轮按最新要求修改现有前端。Python、Netlify 后端、SQLite/Blobs、访客身份、业务 ID、知乎适配与用户数据均未修改；未调用真实知乎或付费模型。当前已部署到 [公开站点](https://wanderwise-land-v2-lostmagician155.netlify.app/home)，部署 ID 与公网检查见 [PUBLIC_DEPLOYMENT.json](PUBLIC_DEPLOYMENT.json)。

## 四项修改

1. **删除简化阅读模式。** 移除界面、设置项、窄屏/触屏自动切换和错误回退。清除旧 mode2d 偏好，旧 ?mode=2d 链接改回正常三维入口；不清除 Cookie、IndexedDB 或业务存档。图形不可用时显示错误，提供重试/低画质重试。真正 WebGL 上下文丢失后重新创建唯一 canvas 与渲染器。
2. **删除准星，靠近即读。** 金句约 4 米内，左键打开最近金句对应的原文；不依赖屏幕中心、相机方向或文字 LOD。附近金句优先于主题标记，提示框明确显示将打开哪一条。设施保持约 3 米内激活。玩家到目标的墙体遮挡仍有效，不能隔墙触发。E/F/B/R/T/V、跳跃、滚轮、暂停和输入隔离保留原功能；附近选取同时服务这些按键。
3. **原地更新主题扩展。** 原先 expandNode 在扩展后调用 setScene，导致 pause、释放指针锁定、重置相机/到访计时并重建 DOM。现在同源 Worker 生成新增后的场景几何，传输 ArrayBuffer；主线程只替换世界几何、碰撞和目标数据。当前位置、跳跃速度、镜头、按键、导航、到访状态与 RAF 不重建。自动扩展不替换 app DOM，不要求重新进入漫游。切场/销毁会取消在途 Worker，迟到结果不能覆盖新场景；失败保留原场景。
4. **远近文字层次。** 主题采用较粗无衬线字、深色路标底板、环境色边框；环境说明用较小标签；金句采用奶油色纸张、衬线字与选中描边。远处主题在屏幕上保持至少约 26 CSS 像素字高，近处金句抬高减少角色遮挡。按近处金句、较近主题优先做屏幕包围盒避让，主题路标在通过碰撞视线检查后作为导向层显示，避免树冠把字切断；金句与家园标签仍保留深度遮挡。最多 10 个候选主题、6 条候选金句，纹理缓存仍有上限。

渲染仍是同源 Three.js、一个活动 canvas/renderer/RAF，沿用实际 GLB；未重制家园模型或更换技术栈。旧 WebGL 渲染回滚也复用就近选取与后台世界更新；其文字美术保留旧版。

## 实际检查与边界

- `evidence/browser-checks.json`：真实有界面 Chrome、真实本机 HTTP/访客 Cookie。包括触屏+窄屏+旧偏好/链接、背对金句左键读原文、E/B/F/V/R/T、实际文章场域、保存回家刷新、真实自动扩展保持鼠标锁定、上下文丢失与低画质重试。
- `evidence/expansion-trace.json`：扩展前后位置/相机/版本与资源，DOM 替换和鼠标解锁次数；只含独立测试访客诊断，不含密钥。
- `evidence/worker-checks.json`：独立引擎夹具检查失败保留旧场景、快速切场取消、十次更新保持控制/资源、销毁取消；不冒充真实业务验收。
- `evidence/unit-tests.txt`：原引擎 10、GLB/碰撞 6、存储身份 6、就近交互 3 项；`build.txt` 记录前端语法与本地预构建。
- 实测为 Apple M5/macOS、Chrome 152、1920×1080 DPR1，另用 800×900 触屏浏览器配置验证不会自动降级。没有实机手机全套触控操作验收，没有声称无 WebGL2 的设备也能渲染三维。
- 本轮没有重新执行上一版 20 分钟性能验收，原报告仍是历史证据。后台生成避免在主线程重建大段地形；GPU 缓冲上传仍发生在主线程，不能保证任意大世界完全没有慢帧。

## 截图

[远处主题](evidence/world-distant-labels.png) · [靠近金句](evidence/nearby-quote.png) · [实际原文](evidence/actual-reader.png) · [文章场域](evidence/article-field-labels.png) · [保持漫游的扩展结果](evidence/expanded-without-interruption.png)

全部来自本轮运行中的应用，使用独立访客与演示路线；取景用本地 QA 相机接口，业务操作使用真实 DOM/键鼠。没有概念图或离线渲染。

## 启动、升级、回滚

仍在项目目录运行 `python3 start.py`，Windows 可双击 start.bat。前端和库已经预制，最终用户无需 Node/Blender。开发者可运行 `npm run build:cloud` 生成本地 dist，这不会部署公网。

刷新当前本地网页加载新版。升级现有安装时保留 data、.env、Cookie 和 IndexedDB，只替换已备份的 frontend；不要复制验收数据库。其他后端文件无需改变。

修改前的前端快照位于工程旁 `../rollback-before-roaming-update/frontend-before-roaming.tar.gz`，SHA 见 BASELINE.json；分发包内路径为 `rollback/frontend-before-roaming.tar.gz`。需要回滚时先停自己的服务，在单独目录解压核对，再替换 frontend。备份只含前端，不含用户存档，不需要删除任何数据库。

前序 home_acceptance.py/home_failures.py/home_world_browser.py 是依赖旧 2D UI 的历史脚本，只用于旧版归档复验；当前版本请运行 roaming_browser.py、roaming_worker_browser.py 和 npm run test:roaming。
