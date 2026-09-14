# RTX PRO 6000 部署

服务器：SSH 别名 `RTX-PRO-6000`，项目 `/home/xiayouyang/code/Wanderwise-v4`。

## 运行结构

- Node 24.12.0 + Express 在服务器 `127.0.0.1:4187` 提供已构建网页与内容 API。
- `wanderwise-v4.service`、普通公网隧道、GPU 网关、GPU 公网隧道均为 systemd 用户服务。已启用用户 linger，退出 SSH 不停止服务。
- 普通入口使用访问者设备的 WebGL。独立云渲染入口使用容器里的 Firefox，经 NVIDIA EGL/OpenGL 绘制，再由 Selkies/NVENC 输出 1920×1080 H.264、目标 60 FPS 的视频通道。
- 初次部署的复杂观星台观察到约 31–42 FPS，记录在 `artifacts/rtx-cloud/runtime-verification.json`。2026-09-14 更新后的采样见下节。视频通道 60 FPS 不等于场景每秒产生 60 个不同画面。
- GPU 固定为 UUID `GPU-e796262d-3449-6af1-586d-8460d8836d1b`，PCI `0000:9c:00.0`，渲染节点 `/dev/dri/renderD130`，对应 RTX PRO 6000 Blackwell Server Edition。

## 隔离与数据

容器 `wanderwise-v4-gpu` 使用 `--network none`、非 root 用户、`cap-drop ALL`、`no-new-privileges`，只挂载专用 IPC 目录和浏览器数据卷，不挂载代码、SSH、宿主桌面或 Docker socket。浏览器保持默认沙箱设置，未添加禁用沙箱参数。容器没有独立外网访问；原文外链可在普通网页入口阅读。

两个 Unix socket 连接云浏览器与项目及视频网关。网关仅监听宿主 `127.0.0.1:4190`；Cloudflare 隧道提供公网 HTTPS。云渲染登录要求独立访问码；服务器检查来源，登录错误限流，使用有效期两小时的 HttpOnly / SameSite=Strict / Secure Cookie。匿名 HTTP API 和 WebSocket 均拒绝访问。访问码重启后保留；网关重启会要求重新登录。

这是单人预览会话，持有访问码的人控制同一云端浏览器。普通网页访客各自的本机数据相互独立。未来多人云渲染应为每位玩家分配独立容器与数据卷，不能把本会话作为多人隔离实现。

- 项目公共数据：`artifacts/content-service/content.sqlite3`。
- 云浏览器个人数据：Docker 卷 `wanderwise-v4-gpu-profile`；不要用 `docker volume rm` 清理它。
- 云渲染访问码：`~/.local/state/wanderwise-gpu/session.env`，权限 `0600`。
- 私有运行指标：`~/.local/state/wanderwise-gpu/ipc/metrics.json`，只记录绘图设备、帧率、绘制量和当前路由。没有指标的场景不沿用上一个场景的 FPS。
- 原本 Mac 的浏览器 IndexedDB 不会自动同步到云端。可使用项目已有的个人数据导入导出。
- 知乎官方 CLI 的 macOS 钥匙串认证未迁移；服务器当前能用精选资料和已迁移 SQLite 缓存，实时知乎检索、直答及 AI 合成尚未配置。

## 版本来源

- [Selkies 官方项目](https://github.com/selkies-project/selkies)，MPL-2.0。
- 基础镜像 `ghcr.io/selkies-project/selkies/desktop@sha256:c958a33d22074456fd99507d71cb0aa9a155eb5d71d26da1040ae4fb126043e0`，取自 `latest-ubuntu26.04` 的 amd64 清单。
- Docker 守护进程访问 GHCR 超时，使用 [Google go-containerregistry](https://github.com/google/go-containerregistry) 的 `crane` v0.22.1 下载并校验后 `docker load`；未修改共享 Docker 守护进程网络设置。
- 导入镜像别名 `wanderwise-selkies-base:20260913`，当前衍生镜像 `wanderwise-gpu:20260914-latency`。
- cloudflared 2026.9.1 官方 Linux amd64 文件 SHA256：`03f1f25d1cc93b9ad6c60569d44060bc4f17ed97075760ed8cfca4b12dcd68cc`。

## 运维

```sh
ssh RTX-PRO-6000
cd /home/xiayouyang/code/Wanderwise-v4
systemctl --user status wanderwise-v4 wanderwise-v4-tunnel wanderwise-v4-gpu-gateway wanderwise-v4-gpu-tunnel
docker stats wanderwise-v4-gpu --no-stream
docker logs --tail 40 wanderwise-v4-gpu
journalctl --user -u wanderwise-v4-gpu-gateway -n 30 --no-pager
```

只重启网页/API：`systemctl --user restart wanderwise-v4`。

暂停 GPU 会话：`docker stop wanderwise-v4-gpu`；恢复：`docker start wanderwise-v4-gpu`。容器设置 `unless-stopped` 自动重启策略。停止时保留浏览器卷。

查看当前公网链接：

```sh
journalctl --user -u wanderwise-v4-tunnel --no-pager | rg 'https://[a-z-]+\.trycloudflare\.com'
journalctl --user -u wanderwise-v4-gpu-tunnel --no-pager | rg 'https://[a-z-]+\.trycloudflare\.com'
```

Quick Tunnel 无固定域名，隧道进程重建/服务器重启可能产生新地址；不应重启隧道来更新普通网页代码。需要固定链接时改用命名隧道和自有域名。

更新云渲染镜像后，应先停止旧容器再保留改名，新容器继续挂载同名浏览器卷：

```sh
docker build --pull=false -t wanderwise-gpu:20260914-latency deploy/rtx-pro-6000/gpu
docker stop wanderwise-v4-gpu
docker update --restart=no wanderwise-v4-gpu
# 使用未被占用的备份名称，不能覆盖已有备份。
docker rename wanderwise-v4-gpu wanderwise-v4-gpu-backup-YYYYMMDD-HHMM
bash deploy/rtx-pro-6000/gpu/start.sh
```

`start.sh` 依赖本机已核验的 GPU UUID、DRM 节点与用户组。迁到其他主机时须重新核验，不能原样使用设备索引。

HTTP 访问隔离检查（不会打印凭据）：

```sh
/usr/bin/python3 deploy/rtx-pro-6000/gpu/verify.py https://CURRENT-GPU-URL.trycloudflare.com ~/.local/state/wanderwise-gpu/session.env
```

## 2026-09-14：云页面更新与视角延迟修复

网页部署和云浏览器加载是两个独立环节。原容器持续运行约 21 小时，部署新的 `dist` 不会替换 Firefox 已加载的 JavaScript。

- 内部代理在页面中注入实际 HTML 的 SHA-256，并提供仅容器内可用的 `/__cloud/version`。每 15 秒检查发布变化；没有按键、阅读或编辑面板且闲置 5 秒后才刷新，沿用原网址和浏览器个人数据。
- 登录后的 `/cloud/status` 返回当前浏览器的版本、GPU、帧率、浮岛数量、鼠标状态和路由。与 `/cloud/client.js` 一样受原访问码认证保护。状态不包含个人内容，写入指标采用原子替换。
- 固定 Selkies 版本用覆盖视频的 `overlayInput` 搜索输入接收游戏按键。适配器将其视作串流输入，普通设置输入仍保留正常行为。观看端取得鼠标锁定后，再向云端发送 F，复用 Selkies 的 `m2` 相对位移和每帧合并；无需改动供应商代码。
- 一次 Esc 释放两端鼠标。E/H 和远端面板打开时释放观看端，避免额外 Esc 关闭刚打开的阅读或调酒界面。云端新场景不自行锁定鼠标，解锁时忽略绝对悬停位置；仍允许转发的触屏拖动。普通浏览器保持原有自然鼠标视角。
- E/H 在云端游戏也直接释放鼠标锁，即使附近没有可交互物件，也不会遗留只有服务器锁定的状态；此操作不发送 Esc、不关闭面板。
- 观看端已锁定但远端尚未确认时，自动重试 F，覆盖场景画布先创建、输入控制器后挂载的时序。远端确认、面板打开或观看端释放后停止重试。
- 默认为 1920×1080、目标 60 FPS、NVENC H.264 CBR 8 Mbps，提供 16 Mbps 精细档；关闭 4:4:4 并开启持续视频模式。按键和鼠标继续使用原独立输入通道。网关显式关闭 TCP Nagle 延迟。
- 健康检查同时检查应用 HTTP 和实际的 Unix 视频 socket；容器没有开放 TCP 8080，不能用它判断串流健康。

GPU 更新前后的配置、镜像记录保存在服务器 `artifacts/deploy-backups/gpu-latency-20260914/`；旧容器保留为 `wanderwise-v4-gpu-before-latency-20260914`。浏览器数据卷、原访问码和两个公网隧道均保留。网关重启会使原登录 Cookie 失效，需要使用原访问码重新登录。

最新完整花园的 10 次采样：实际渲染平均 54.6 FPS，视频平均 59.4 FPS，各窗口的 p95 帧时指标平均 24.8 ms；公网往返平均 407 ms，范围约 394–419 ms。测试来自本机 Chrome 连接当前 Cloudflare 入口，不能代表所有网络。码率减半和输入修复不能消除这条网络路径的往返时间。当前仍采用 WebSocket + HTTP/2 隧道；进一步降低延迟需要测试就近入口及 WebRTC 直连/中继的网络条件，而非仅增加 GPU 预算。Selkies 的可选 WebRTC 传输见[官方说明](https://github.com/selkies-project/selkies)。

回归检查：

```sh
node scripts/test-cloud-stream.mjs
node scripts/test-scene-look.mjs
python3 deploy/rtx-pro-6000/gpu/test-origin.py
```

本机 `artifacts/gpu-latency-20260914/final-verification.json` 汇总最终结果，`verification.json` 保留基础串流检查、逐次采样与定时行走脚本的失败记录，`navigation-verified.json` 保存到达实际传送点后按 E 返回观星台的成功验证，`http-checks.json` 保存访问边界检查。导航验证必须轮询已完成的远端状态，不能将异步谓词返回的 Promise 当成成功，也不能将固定按键时长当成已到达目标的证据。新容器和新游戏代码均已实际加载验证，不能仅凭上传文件成功就判定发布完成。
