# 当前写实小屋资产（1.2.0）

Poly Haven：Arm Chair 01、Gothic Cabinet 01、Shelf 01、Wood Floor、Plastered Wall 02，CC0。作者、原文件、获取时间与 SHA-256 见 `assets-source/polyhaven/manifest.json` 和 `docs/realistic-home/ASSETS.md`。新增建筑、定制设施、布料法线及可复现脚本为本项目 MIT。Rapier 0.19.3 为 Apache-2.0，许可随 `frontend/vendor/rapier/LICENSE` 提供。Three.js 0.186.0 为 MIT。旧 KayKit 文件仅保留供旧版本/回滚，不是当前小屋加载资产。

以下保留历史版本的许可说明。

---
title: "素材、来源与许可清单"
date: 2026-09-09
---

# 素材与许可

当前家园升级的完整登记见 [本轮资产清单](docs/home-upgrade/ASSETS.md) 与 ASSET_MANIFEST.json。新增 Three.js 0.186.0（MIT）、KayKit Furniture Bits 1.0（CC0）及原创 Blender GLB。以下“原创低模/原生渲染器”表描述保留的旧版资产，不代表新版没有第三方库。

本包不打包任何字体文件、真实知乎作品全文库、API key、OAuth Token、第三方付费素材或未核验许可的模型。

| 实际随包项目 | 文件/来源 | 属性与使用范围 |
| --- | --- | --- |
| 原创低模小屋、树、石头、地形、道路、四设施、角色 | `frontend/engine/geometry.js`、`scenes.js` | 本项目新编写的程序化几何，随项目 MIT；不是 KayKit/Quaternius 模型 |
| 原创渲染器、SDF、相机/碰撞/导航 | `frontend/engine/renderer.js`、`engine.js`、`math.js` | 本项目代码，MIT；没有复制 Third-party Three.js 库（此项仅指旧渲染器；新版库另列） |
| 原创标志 SVG 和 DOM 界面 | `frontend/assets/mark.svg`、`style.css`、`app.js` | 本项目创作，MIT；用户提供的品牌/宣传语按其原始权利处理 |
| 原创演示短文 | `demo-data/original_articles.json` | 12 篇随包原创示例，MIT；provider=demo，始终标记非知乎数据 |
| 字体 | 浏览器系统字体栈 | 不分发字体文件；用户系统需有中文字体；截图中的字形不等于字体文件被附带 |
| 合成音效 | `app.js` 中 Web Audio 振荡器 | 运行时生成，无第三方音频文件；用户开启后播放 |
| 测试截图与离屏预览 | `docs/screenshots/`、`docs/evidence/` | 本项目测试生成；截图只使用演示数据；图示范围在测试报告中说明 |

## 文档提到但未接入的外部素材

[KayKit Forest Nature 官方作者页](https://kaylousberg.itch.io/kaykit-forest)可核对免费包与 CC0 声明，但本次未下载模型，不把“有官方链接”写成“已集成素材”。Quaternius 的具体包与版本需按用户清单逐项确认，未下载/未分发。用户通知中的“看山三视图.zip”“刘看山动态.zip”只有名称，未提供可用附件或下载URL，因此本版不含这些素材，也没有临摹后冒称官方授权形象。

[Three.js 官方文档](https://threejs.org/docs/)和 [MDN WebGL2](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext)作为技术参考，不意味着依赖或模型已经包含。旧原生渲染器不直接导入 glTF；本轮已经通过 Three.js 原生适配器接入经过核验的 KayKit Furniture Bits，未采用 R3F。

## Python 依赖

Python 软件包由用户首次安装，代码本身未复制进压缩包。主要依赖为 FastAPI、Uvicorn、Pydantic、HTTPX；各许可证以安装版本的 package metadata/LICENSE 为准。运行环境版本记录在测试报告及 `requirements.txt`。开发测试额外用 pytest、Playwright；离屏检查使用 NumPy/Pillow 和系统 EGL 库，不是应用运行依赖。

## 知乎内容

接口可读取不等于获得无限再分发权。运行期按阅读/导览所需范围缓存，真实作者和来源保留；不提供整库导出工具。活动作品改编、长期公开正文镜像和超出赛事用途的使用须另行核对官方规则。项目 MIT 不替第三方作品或用户资料授予许可。
