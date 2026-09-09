# 契约

`openapi.json` 由本版 FastAPI 实际请求模型导出，应用也提供 `/api/openapi.json`。通用 JSONResponse 的详细响应结构在自动 OpenAPI 中不完整，请结合 `demo-world.example.json` 和后端测试；本版不宣称拥有完整 TypeScript 生成链。

`demo-world.example.json` 是本项目原创示例的世界结构，不是真实知乎API返回。示例的来源ID不可拿到官方接口请求。实际世界通过用户会话生成。

本版字段扩展包括连续陆地 `walkableLinks.kind=path`、camera/navigationMode、写入租约接口和显式手工合成模式。与输入需求文档的示意契约差异详见 TECH_DECISIONS.md。
