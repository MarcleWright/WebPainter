# F1–F2 native line / direct layer admission follow-up

Owner 授权 ADA 最新 Independent Re-review Follow-up 2026-11-09 F1–F3 连续修复。本记录归属 WP main 通用能力，main→embedded 单向同步；ADA 自有创建暂存 F3 另记。开工 main b369c45 clean，embedded a6d2228 clean，ADA f7b3c12a 保留 reviewer task dirty；不开分支、不推送/发布。

F1 真实 ShapeTool 不同象限、水平/垂直的 origin.w/h 是从起点到终点的有符号增量。native 只对 kind=line 接受有界 signed w/h，其他形状仍非负；几何/路径不取绝对值、不扁平化。属性面板对直线显示 ΔX/ΔY 并保留负值/零，沿用 pathFromOrigin 编辑方向。native v1 数据结构/port不变。

F2 同一 action policy 约束 LayersPanel 按钮/上下文菜单与对应 LayerOps；declared masks/effects/smartObject feature 同时约束相关 action 与直接入口。菜单填充/调整也结合对应 action；属性 mask controls 使用 feature admission。visible/enabled 独立，隐藏本身不禁用执行；独立 WP 默认完整。不建立配置服务或插件框架。

先加定向回归：实际逆向 line encode失败，真实挂载 LayersPanel 的新组按钮在隐藏/禁用配置下仍出现/执行。修复后 main native/access/line/UI 39项通过；真实 UI 仅缩略图绘制替换为无副作用占位，按钮/上下文/操作/文档/history 为真实实现。F1 包含八方向的 origin/path、合成一致、重开 endpoint编辑及undo/redo、其它形状非法几何拒绝；后续 embedded capture/save/snapshot 和 ADA新包实窗另行记录。

ADA首次创建原反例也先红灯；F3属ADA，不在main引入业务或存储逻辑。完整运行配套、包hash与Pending以 ADA正式任务本轮最终记录为准。独立复审/Owner验收尚未完成。
