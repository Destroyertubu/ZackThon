# 独立自动展示与录制

本目录只服务 `Wanderwise-showcase`。不会重启或操控旧的 `wanderwise-v4-gpu`、其浏览器卷、网关或隧道。

控制台为新服务的 `/showcase`，仅绑定宿主 `127.0.0.1:4192`，由独立 `wanderwise-showcase-tunnel.service` 暴露 HTTPS。直接打开网址即可使用页面、任务控制和历史产物下载，不需要访问码、登录 Cookie 或密钥文件。启动与取消仍检查请求同源，私有 viewer 控制通道不对公网开放。

录制任务互斥。每次创建新的无网络 GPU 容器、Xvfb `:30`、Firefox profile、IPC 和输出目录，持续使用这个 profile 完成八镜。GPU 仍与其他进程共享算力；独立输入和存档不代表零性能影响。新镜像从已验证的 `wanderwise-gpu:20260914-latency` 派生，保留 EGL/DRI3 启动但移除 Selkies 及 TURN，不再编码公网串流。

构建：

```sh
VITE_SHOWCASE=1 npm run build
docker build --pull=false -t wanderwise-showcase:20260914 deploy/showcase
```

宿主项目目录：`/home/xiayouyang/code/Wanderwise-showcase`。新服务文件复制到用户的 systemd 目录后启用 `wanderwise-showcase.service` 与 `wanderwise-showcase-tunnel.service` 即可。不要使用旧 GPU 的 `start.sh`。

前端协议：

- 入口 `/observatory?showcase=1&renderRuntime=rtx`。
- 私有页面代理在 HTML 注入 `controller.js`。命令和结果仅通过任务自己的 Unix socket 访问；公共控制台不暴露 `/__showcase/*`。
- `await window.__showcase.prepareShot(id)` 完成加载及镜头定位，随后服务暖场 750 ms；此段不进入成片。
- 录制器首帧出现后调用 `await window.__showcase.playShot(id)`。动作失败必须 reject，不允许把定时完成冒充动作成功。
- `window.__showcase.snapshot()` 给出 ready、shotId、status、error 与 adapters。每两秒记录一次场景尺寸、GPU 与快照，成功产物包含 `evidence.json`。
- 分镜由 `docs/showcase/storyboard.json` 定义。每镜剪裁成指定时长；最后镜头末尾五秒由其第九秒提取的 `closing.png` 替换，总时长保持 180 秒。

FFmpeg 整页采集包括 DOM 与 WebGL，1920×1080、30 FPS、`-draw_mouse 0`。先验证 NVENC 初始化；不可用时回退 libx264。成片 H.264/yuv420p、AAC，默认版烧录中文字幕，另存无字幕版 MP4、单独 SRT、旁白 WAV 与文稿，两版混入同一预制旁白和低音量原有背景音乐。只有各片时长与最终 `ffprobe` 验证通过才提供下载。

公开内容只来自仓库既有快照和精选来源，服务使用内存 SQLite、禁用实时搜索和刷新，拒绝上游 fetch。每任务新浏览器 profile 避免读写玩家数据。

本机 UI 验证可显式启用独立 loopback viewer：

```sh
SHOWCASE_LOCAL_VIEWER=4193 SHOWCASE_STATE=/tmp/wanderwise-showcase-qa node --import tsx server/showcase/index.ts
```

访问 `http://127.0.0.1:4193/observatory?showcase=1&renderRuntime=rtx`，使用单独浏览器 profile。该端口只绑定 loopback，并且只在明确设置环境变量时启动。控制台同样直接通过 `http://127.0.0.1:4192/showcase` 访问。

匿名校验工具不读取任何凭据：

```sh
node --test scripts/showcase/server-tests.mjs
python3 scripts/showcase/verify-console.py http://127.0.0.1:4192 --start-smoke
```

任务产物：`~/.local/state/wanderwise-showcase/jobs/<id>/output/output.mp4`。取消或服务重启只清理同时匹配 `com.wanderwise.showcase=recording` 标签和 `wanderwise-showcase-` 名称前缀的录制容器；历史产物保留，不删除现有云游戏容器。

每镜普通失败会重新准备并重录一次；第二次失败停止生成，取消不重试。证据保留每次尝试的时间与错误，未完成的媒体不会提供为成功下载。最终控制台仅呈现生成、取消、重试和产物下载；10 秒探针保留为后端诊断 API。

新 Firefox profile 使用官方 `SkipTermsOfUse` kiosk 策略跳过已获授权的首次欢迎层。私有 viewer CSP 允许 `blob:`/`data:` 纹理资源以完整还原 GLB 内嵌材质，同时容器没有外网。Noto Sans CJK SC 由镜像系统字体提供，libass 直接烧录。

完整验收任务 `977b33b7-7114-4c0a-8172-d0cc233cc6fe` 与 `265c48a7-4d44-48df-97f0-7472006e2f26` 使用同一前端、录制及精确裁切版本，均为 180 秒、5400 帧。首片 montage 的片段后诊断曾混入 1024×576、无展示 API 的心跳；实际镜像的 Firefox `BackgroundPageThumbs.sys.mjs` 会匿名加载历史页面并按屏幕比例创建这种尺寸，特征一致。历史日志没有浏览器实例 ID，来源判断属于高置信推断。两次各八镜的动作确认时间均与最后主展示实例的累积事件一致，真实画面和动作通过验收；二次八镜诊断尺寸全部正常。原始证据保留，不修改该条诊断。

验收后仅增加运行隔离与证据修复：关闭 `browser.pagethumbnails.capturing_disabled` 对应的后台缩略图采集（设为 `true`），控制器仅在初始 URL 含 `showcase=1` 时安装，正式片段的浏览器证据直接取该次 `playShot` 确认结果。SPA 删除查询参数后已安装的控制器仍继续运行。没有改动前端、镜头时间轴或两次成片；该修复另以入口隔离回归与 10 秒 GPU 探针验证。
