# 刘看山源文件与参考

本目录保存用户提供的角色参考、独立重建的可编辑模型，以及真实模型的渲染验收。

原始来源：

- `/Users/gauss/Desktop/SuperTechMagician/SolarMaster/ZackThon/漫知录/看山三视图.zip`
- `/Users/gauss/Desktop/SuperTechMagician/SolarMaster/ZackThon/漫知录/刘看山动态.zip`

已实际查看三视图、白底透视图与待机、打招呼、电脑、瞌睡动画帧。`references/` 内原 JPG 与 GIF 按原始字节提取；`*-frame*.png` 仅是为检查动作而解码的 GIF 帧，不会进入运行时模型。

用户将这两份压缩包标明为官方素材；角色和参考图的权利属于原权利人，**不是 CC0**。新模型是基于参考的独立立体改建，不代表官方提供的 3D 模型。来源文件名和校验值记录在 `source-manifest.json`。

- `liukanshan.blend`：最终可编辑模型和柔光摄影棚。
- `renders/front.png`、`side.png`、`back.png`：最终三视图。
- `renders/hero.png`：最终三分之四视图。
- `renders/web-*.png`：实际 GLB + R3F 组件的网页状态验收。
- `preview.html`：360° 拖动和五种状态切换的独立开发验收页。
- `runtime-report.json`：网页错误检查与关闭动态后的固定关节验证。

建模过程与运行接口见 `public/models/liukanshan/README.md`。唯一构建入口是 `scripts/build-liukanshan.py`；角色动作在 `src/components/home/mascot/liukanshanAnimation.ts` 参数化。
