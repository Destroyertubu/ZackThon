# 本次本地独立验证（2026-09-09）

环境：macOS ARM64，Python 3.12.13，Node.js v24.14.1。工程依赖安装于项目 `.venv`。系统默认 `python3` 为 3.9.6，不满足项目要求，应使用项目解释器。

- 后端：21 项通过，0 项失败；1 条第三方弃用告警，无测试失败。
- 引擎：10 项通过，0 项失败。
- 前端：7 个 ES Module 语法检查通过。
- Python 依赖检查：没有依赖冲突。
- 真实本机 HTTP：健康、首页、前端模块、访客创建均 200；HttpOnly 和 SameSite=strict Cookie 校验通过。使用临时隔离 SQLite，首轮检查结束后删除。

证据为本目录 `checks.json` 和 `http-smoke.json`。本次未修改业务源码，未调用真实知乎或 AI。上述检查不能替代云端持久化、公网 HTTPS 和浏览器 3D 验收。

部署要求：Python >=3.11，`APP_ORIGIN` 与实际访问地址精确一致，公网 HTTPS 设置 `COOKIE_SECURE=1`，只运行一个 worker / 实例，SQLite 数据目录使用可写持久卷。
