# 本次云端部署准备

原始 ZIP 已完整解压。此文件描述新增的 Linux 云服务器部署配置，不表示已经上线；真实部署状态见 `cloud-deployment-status.json`。

## 运行环境

使用一台已授权的 Linux 云服务器、Docker Engine + Compose，以及指向这台服务器的域名。80/TCP、443/TCP 需可从公网访问；443/UDP 可用于 HTTP/3。已有网站占用 80/443 时，应接入现有反向代理，不能直接启动本配置争用端口。

从工程根目录执行：

```bash
cp deploy/cloud.env.example deploy/cloud.env
# 将 deploy/cloud.env 中 WW_DOMAIN 改成实际域名，例如 wanderwise.example.com。
docker compose --env-file deploy/cloud.env -f deploy/compose.cloud.yml config --quiet
docker compose --env-file deploy/cloud.env -f deploy/compose.cloud.yml up -d --build --wait
```

访问 `https://实际域名`；简化阅读模式为 `https://实际域名/?mode=2d`。Caddy 会申请并续期证书，前后端共用同一域名。配置使用独立命名卷保存数据库及证书；后端不对宿主机开放端口。保留现有访客 Cookie 才能恢复对应存档。

`FORWARDED_ALLOW_IPS=*` 仅适用于这个没有后端公开端口的独立 Docker 网络。若改变网络、增加后端端口或共享该网络，需同步限制可信代理。应用及反向代理都未启用逐请求访问日志。

## 单实例、更新与备份

此版本只运行一个后端实例；不要配置多副本或新旧实例重叠的滚动更新。启动会把之前未完成的任务标记中断；更新期间应暂停新操作。

先在线备份，再更新镜像。以下命令需在工程根目录运行：

```bash
backup_name="wanderwise-$(date -u +%Y%m%dT%H%M%SZ).sqlite3"
mkdir -p backups
docker compose --env-file deploy/cloud.env -f deploy/compose.cloud.yml exec -T wanderwise python tools/backup.py "/app/data/$backup_name"
docker compose --env-file deploy/cloud.env -f deploy/compose.cloud.yml cp "wanderwise:/app/data/$backup_name" "backups/$backup_name"
docker compose --env-file deploy/cloud.env -f deploy/compose.cloud.yml up -d --build --wait
```

将备份另存到受限的独立存储；同服务器副本不能抵御服务器丢失。不要执行 `docker compose down -v`，它会删除数据卷。恢复程序沿用 `DEPLOYMENT.md`，必须先停后端，避免混用旧 WAL。产品自身仍执行 30 天不活跃访客清理策略。

## 云端验收

确认 HTTPS 证书可信、HTTP 自动跳转 HTTPS，检查 `/api/v1/health/live` 及 `/api/v1/health/ready`。再使用独立浏览器访客完成路线生成、阅读、收藏、手工合成、刷新恢复，确认 Cookie 的 Secure/HttpOnly/SameSite=Strict、异源写入拒绝和不同访客数据隔离。重启唯一后端后再次用原 Cookie 读取同一存档，才能记录持久化验收通过。

本次默认使用原创演示内容。真实知乎与 AI 需要另行配置服务器凭证并执行真实接口核验，配置存在不等于接口已通过。

配置依据：[Docker Compose 启动顺序](https://docs.docker.com/compose/how-tos/startup-order/)、[Caddy 自动 HTTPS](https://caddyserver.com/docs/automatic-https)、[Caddy 请求体限制](https://caddyserver.com/docs/caddyfile/directives/request_body)。
