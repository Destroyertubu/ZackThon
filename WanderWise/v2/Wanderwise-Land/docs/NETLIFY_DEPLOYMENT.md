# Netlify 陆地 v2

本次按用户指定平台部署至独立 Netlify 站点，旧版站点保持可用。实际部署结果及验证记录见 `cloud-deployment-status.json`。

## 与原始包的关系

原始 Python/FastAPI/SQLite 版本仍可通过 `start.py` 本地启动。Netlify 云端使用新增的 `cloud/` 后端、Netlify Functions 和 Netlify Blobs；前端继续使用原版 ES Modules/WebGL2。构建只复制前端并调整“本机服务”为“云端”的状态文案。

Netlify 原生 Functions 提供 JavaScript/TypeScript/Go 运行方式，构建环境中的 Python 不等于常驻 Python 应用。因此本次没有将 SQLite 放入临时函数目录，也没有将静态页面冒称完整部署。[Netlify Functions 文档](https://docs.netlify.com/build/functions/get-started/)

云端保持 `/api/v1` 合同：访客、三条演示路线、来源阅读、正文场域、世界扩展、收藏与连线、私人锚点、手工洞察、旅程检查点、租约、暂停/继续/归档及星图。原版 12 篇演示内容与 3 条路线在两个后端的结构化数据逐字段一致。

## 数据与并发

每个访客使用随机 HttpOnly/Secure/SameSite=Strict Cookie，服务端按 Cookie 的 SHA-256 分区。写入校验同源 Origin 和 CSRF，所有实体读取均限制在当前访客的存档内。Blobs 使用强一致读取和 ETag 条件写入；冲突时重读并再次验证实体版本，防止覆盖其他标签页的修改。[Netlify Blobs 文档](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)

生产命名空间固定为 `wanderwise-land-v2-production`，可跨重新部署保留数据；预览按部署 ID 隔离。删除账号数据写入墓碑，阻止并发请求恢复已经删除的私有记录。每天清理过期访客；仍采用 30 天不活跃会话期限。单访客文档设有 12 MB 上限，超限返回明确错误。

云端生成任务在一次函数调用内完成，完成结果与存档一起提交，然后返回任务对象。调用上游之前持久化幂等声明；重复请求不会重复调用接口，结果不明时要求显式重新发起。任务执行方式与原版线程池不同，长任务恢复及执行中的取消不计为已经通过原版验收。

SQLite 备份命令仅适用于 Python 部署。Netlify 部署使用 Blobs，不能拿原版 SQLite 备份报告代表云端备份恢复。云端独立备份恢复尚未验收。

## 凭证与默认体验

本次独立站点默认不配置 `ZHIHU_ACCESS_SECRET`，原创演示与手工洞察可直接体验。云端保留搜索、公共赛事知识目录/正文和 AI 协议适配；真实密钥有效性和 AI 实际生成仍需单独核验。

需要启用时，在 Netlify 站点环境变量中安全配置 `ZHIHU_ACCESS_SECRET`（Functions scope），并可配置 `ZHIHU_MODEL`、`ZHIHU_SEARCH_DAILY_BUDGET`、`ZHIHU_AI_DAILY_BUDGET`、`WW_HOURLY_TASK_LIMIT`。修改运行时配置后重新部署。不要将密钥写入 `netlify.toml` 或前端。

## 构建与验证

```bash
npm ci
npm run test:cloud
npm run build:cloud
netlify deploy --prod --context production
```

测试使用隔离内存存储及模拟上游，覆盖同源/CSRF、访客隔离、并发条件写入、幂等、来源、布局、租约、知识资产和上游错误边界。公网验收另外验证真实 HTTPS、函数读写及浏览器 Cookie/IndexedDB。最终结果以部署状态文件为准。

本地联调新增后端可运行 `npm run dev:cloud`；该开发服务器使用隔离内存存储，不能作为数据持久化证明。Python 模式不需要 npm。
