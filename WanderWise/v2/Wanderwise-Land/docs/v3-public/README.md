# v3 公网发布

分支v3，房间源码提交35f5cf0d。公网入口：https://wanderwise-land-v2-lostmagician155.netlify.app/home 。站点名称保留v2以延续原网址和生产存储，不代表仍在使用旧房间。

发布后实际确认：新GLB SHA256与源码一致、浏览器无需Netlify登录、一个Canvas/五设施、真实键盘移动、HTTPS/API读写/访客隔离/手工合成、同一访客同一收藏跨部署保留。截图来自公网运行中的应用。具体结果与临时故障修复见PUBLIC_DEPLOYMENT.json及其它JSON。

开发worktree的node_modules最初是符号链接，导致Functions漏带Blobs依赖。后续发布先在独立目录执行npm ci，再运行Netlify production构建并打包函数；不能仅凭静态上传成功认定后台可用。生产存储命名空间未改，未迁移或清空真实访客数据。

这一轮没有重新进行20分钟性能测试；之前的本地性能和未完成美术项仍见../PRODUCTION_ROOM_REPORT.md。没有验证真实知乎或付费AI。
