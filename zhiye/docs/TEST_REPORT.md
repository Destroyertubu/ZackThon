# 知野测试与验收记录

日期：2026-09-08。以下记录仅针对本次交付代码，不等于生产验收或完整安全审计。

## 已执行

| 范围 | 结果 | 覆盖点 |
| --- | --- | --- |
| JavaScript 语法 | 通过 | 前端与脚本模块 |
| Node.js 领域测试 | 10 项通过 | 确定性随机数、桥面碰撞、采样压缩、去重、组合门槛、来源链、Markdown、备份结构 |
| 本机真实 HTTP | 通过 | 独立 Uvicorn、TCP、静态资源、会话 Cookie 后续请求、世界和内容接口、跨源拒绝 |
| Python / FastAPI 测试 | 14 项通过 | 会话、跨站写入限制、体积限制、确定性地图、扩展幂等、数据所有权、版本冲突、公开范围、撤回、双方同意匹配、锚点审核、删除、来源清洗、持久化原子限额、单请求合并、真实模式错误边界 |
| Chromium 桌面界面 | 通过所列交互 | 开始、第一人称场景、采集两个来源、生成一张组合卡、锚点、带真实知识桥梁的画布、保存 |
| 面板暂停移动 | 通过 | 打开画布时按 W 不改变人物位置 |
| 手机页面 | 390×844 无水平溢出 | 种子输入、主标题、导航和场景截图；不是完整触屏设备验收 |
| 浏览器运行异常 | 所列检查中 0 个 pageerror | 不等于所有潜在交互分支均无错误 |

自动化结果摘要保存在 `previews/browser-smoke.json` 和 `previews/http-smoke.json`；界面截图位于 `previews/01-landing.png` 至 `06-mobile.png`。

## 重要的验证边界

测试环境禁止 Chromium 访问 localhost 和 file URL，且无法下载 npm 依赖。为检查真实 UI，测试脚本将本项目 ESM 代码转译后放入内存页面；`fetch` 经 Python 暴露函数调用真实 FastAPI TestClient，API 逻辑与 SQLite 都实际运行。由于 about:blank 是不透明来源，localStorage 与 IndexedDB 使用测试内存实现。

另执行了 `scripts/smoke_http.py`：启动独立 Uvicorn 进程，用 httpx 经真实回环 TCP 访问服务，验证了非 ASGI 模拟的 HTTP 接口与 Cookie 连续请求。这仍不是浏览器网络层或 HTTPS 部署验收。

因此，这次浏览器检查验证了前端交互 + ASGI 应用逻辑，但没有验证真实 Cookie 在浏览器网络层的往返、真实 IndexedDB 事务、HTTP 部署策略或真实指针锁权限。Python 测试单独检查了 Cookie 标记和服务端会话。截图全部使用软件透视三维渲染器，不是 Three.js GPU 截图。

人工构造的上游响应样本只用于测试清洗和错误处理，不应作为官方 beta API 契约。

## 未执行，不能宣称完成

真实知乎密钥与实际搜索返回；官方 Skill 内容核验；知乎 OAuth；真实设备 WebGL2/Three.js 材质与帧率；真实浏览器刷新后的 IndexedDB 恢复；移动端触控完整流程；多实例并发；压力测试；Docker 镜像构建；第三方依赖漏洞扫描；完整内容安全和无障碍审计。

## 本地复现

```bash
python -m pip install -r requirements-dev.txt
npm install
npm test
npm run check
python -m pytest -q
python scripts/smoke_http.py
```

受限环境截图检查：

```bash
npm run preview:bundle
# Linux 默认 /usr/bin/chromium；其他系统请配置路径。
CHROMIUM_PATH=/usr/bin/chromium python scripts/smoke_browser.py
```

如果没有系统 Chromium，可在已安装 Playwright 浏览器后把 `CHROMIUM_PATH` 指向对应浏览器可执行文件。此脚本仅用于受限环境测试，不是生产启动脚本。

正常环境的最终人工验收应直接执行 `python run.py`，打开本机网页，确认底部引擎显示 `Three.js · WebGL2`，并逐项检查：移动、松键、失焦、视角锁定/释放、阅读暂停、组合来源、私有/公开锚点隔离、多人公开匹配、旧链接撤回、刷新后存档恢复、隐私删除以及真实搜索的来源与限额。测试完成后再更新本报告，不把计划写成已通过。
