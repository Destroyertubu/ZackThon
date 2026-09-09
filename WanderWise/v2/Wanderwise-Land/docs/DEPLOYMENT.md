---
title: "启动、部署、备份与恢复"
date: 2026-09-09
---

# 部署与恢复

## 已验证与待验证

本轮验证 Python 启动入口、真实本机 HTTP 健康/静态页面、SQLite 备份恢复及自动测试。未创建任何公网网站；未执行 Docker 镜像构建或 Caddy TLS 签发。配置文件可作为部署起点，不能把它们称为已经上线。

## 最简单的本地运行

```bash
python3 start.py
# 已有依赖，禁止安装：
python3 start.py --use-current --no-install --no-browser
```

默认监听 `127.0.0.1:8000`，数据库位于项目 `data/`。第一次需要 Python 软件源，之后演示功能不依赖外网。前端是原生 ES Modules，可直接由后端分发，不需要 npm、CDN 或打包器。

`.env.example` 仅是配置字段说明；启动器**不自动加载 .env 文件**。开发者凭证使用 `--live` 隐藏输入。静态托管 alone 无法提供本包 Python 后端和 SQLite；把 `frontend/` 拖入 Netlify Drop 不会得到完整应用。本版不是先前 Netlify Functions/Blobs 项目的就地升级。

## 容器方式（本轮未构建）

从项目根目录运行：

```bash
docker compose -f deploy/compose.yml up --build
```

`deploy/Dockerfile` 以 Python 3.13 构建，非 root 用户运行；Compose 仅映射本机端口，`wanderwise-data` 命名卷保存数据库。不要使用多个 replicas，不要把数据库放到临时容器目录。首次 Docker 构建需要拉取基础镜像和 Python 软件包。

环境变量：

| 字段 | 作用 |
| --- | --- |
| `WANDERWISE_DB` | SQLite 文件绝对路径，默认项目 data 下 |
| `APP_ORIGIN` | 浏览器实际访问的完整 Origin；公网例如 `https://你的真实域名`；不带末尾路径 |
| `COOKIE_SECURE=1` | HTTPS 环境强制 Secure Cookie；本机 HTTP 不设置 1 |
| `ZHIHU_ACCESS_SECRET` | 仅服务端的开发者凭证，使用平台 Secret 注入 |
| `ZHIHU_ACCESS_SECRET_FILE` | 可选，托管平台挂载的 Secret 文件路径；不应指向随源码分发的文件 |
| `ZHIHU_MODEL` | 默认 `zhida-fast-1p5`，先核验账户可用型号 |
| `ZHIHU_SEARCH_DAILY_BUDGET` | 默认 1000，应用共享预算，非官方额度承诺 |
| `ZHIHU_AI_DAILY_BUDGET` | 默认 50，应用共享预算 |
| `WW_HOURLY_TASK_LIMIT` | 默认 10，每访客每类任务每小时限制 |

## 公网 HTTPS（需自己的主机、真实域名和持久存储）

将后端仍绑定本机，Caddy 同域反向代理。`deploy/Caddyfile.example` 中的域名是占位符，必须换成自己实际拥有并解析到主机的域名，不能直接照抄。设置对应 `APP_ORIGIN` 和 `COOKIE_SECURE=1`，将 /api 和静态文件一起代理到同一后端。

正式验证：TLS、SPA 刷新、健康状态、Cookie 的 HttpOnly/Secure/SameSite、非同源写入拒绝、两浏览器私有资源隔离、重启后数据保留。反向代理应限制请求体和入口频率，访问日志避免 query、Cookie、私有文本和授权信息；密钥不能出现在构建日志。

健康检查 `/api/v1/health/live` 和 `/api/v1/health/ready` 只检查进程/数据库，不调用知乎。OpenAPI 位于 `/api/openapi.json`。`/api/docs` 使用 FastAPI 默认 Swagger 页面，其外部脚本在本版严格 CSP 下可能无法加载；离线查看随包 JSON，勿为此放宽生产 CSP。

## 备份

```bash
.venv/bin/python tools/backup.py backups/wanderwise-2026-09-09.sqlite3
```

在线备份使用 SQLite 的 backup API，包含已提交 WAL 内容并检查完整性。目标存在则拒绝覆盖。备份可能包括私人锚点、收藏和会话记录，不要加入 Git、比赛公开材料或公开对象存储。

## 恢复

1. 停止唯一运行实例，确认没有另一个进程打开数据库。
2. 对当前数据库做一次备份，保留原文件以便回滚；将现有数据库及同名 `-wal`/`-shm` 文件移入备份目录，不混用旧 WAL 与新主文件。
3. 复制已验证备份到 `WANDERWISE_DB` 的目标位置，保持运行用户可读写，再启动应用。

启动会将未知进行中任务标记中断，不盲目重发可能已计费请求。用原浏览器 Cookie 继续旅程；没有原访客 Cookie 时不应把备份的私人资产任意分配给新访客。

## 故障排查

“安装失败”：检查 Python 版本和软件源；不要直接删业务数据库。端口占用：增加 `--port 8080`。起程只有演示路线：没有验证真实提供器，属于明确降级；不是 key 自动启用成功。403 Origin：确认浏览器使用地址与 APP_ORIGIN 完全一致（localhost 与 127.0.0.1 是不同 Origin）。HTTPS 下刷新丢身份：检查 Cookie 与反代、数据卷，不能用公开 userId 参数替代鉴权。

地图黑屏：打开 `/?mode=2d` 保留阅读闭环；在目标浏览器检查 WebGL2 与驱动支持。此环境不提供“所有浏览器兼容”的承诺。
