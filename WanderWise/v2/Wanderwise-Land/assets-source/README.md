# 原创资产源文件

本版资产的可编辑源文件是 `frontend/engine/geometry.js` 和 `frontend/engine/scenes.js`，不是已下载的 Blender/KayKit/刘看山资源。模型使用右手坐标，Y 向上，1单位约1米。`buildScene()` 返回可见三角形、简化碰撞、交互点和出生点；显示和碰撞分别维护。

`playerGeometry()` 生成披风旅人，idle/walk 具有不同几何姿态；jump 来自控制器纵向位置。小屋、树林与道路由稳定参数生成，颜色和尺度集中在源码。树干碰撞、设施盒碰撞、地面高度与道路通行分开处理。

当前没有交付 `.blend`、第三方原始模型或 GLBLoader。后续更换具体资产必须核验包内许可证、比例、原点、复杂度、碰撞和中文遮挡。不得仅因素材可下载就宣称已集成。
