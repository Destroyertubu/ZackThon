# 可编辑模型与复现

当前 home-full.blend / home-corner.blend 为 Blender 5.2.1 LTS 源文件，纹理已打包。tools/build-home-blender.py 可重建完整小屋与先行角落；运行 GLB/配置在 frontend/assets/home。最终用户不需要 Blender。

kaykit-furniture 保存 8 件选取的 CC0 原模型及完整许可、固定作者仓库版本、获取时间和原始 SHA。实际场景只加载其中 6 件；修改/分发说明见 docs/home-upgrade/ASSETS.md，全部资产 SHA 见同目录 ASSET_MANIFEST.json。

原世界、原角色和互斥回滚小屋仍由 frontend/engine/geometry.js、scenes.js 生成，MIT。Y-up、米制；新小屋通过 COL/SPAWN/INTERACT 独立语义节点与简化碰撞，未改变业务 ID。
