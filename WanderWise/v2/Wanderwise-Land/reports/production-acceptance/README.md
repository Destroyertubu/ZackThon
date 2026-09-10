# 验收证据说明

home-acceptance.json是最终headed Chrome、1203.6秒持续运行结果；raw-frames.json.gz为原始帧记录。failure-checks.json是最终资源释放修改后的独立复测。

acceptance-failure.png保留早期headless焦点检查失败时的画面，不是最终结果；最终headed版本实际失焦检查通过。修复前墙体问题和重测见28-cases.md与G01_decisions.md。

release-extract.json/release-http.json记录第一版白名单ZIP解压启动；后续只增补证据/文档和资源释放、QA摄影修正。最终ZIP另校验CRC及每个清单文件SHA256。所有数据来自隔离测试访客，不含真实用户存档。
