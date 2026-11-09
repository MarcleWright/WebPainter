# 2026-11-09 通用入口能力 seam

本轮四项P2修复的R1通用部分。main提供默认全开的本地access policy seam（visible/enabled独立），统一动作dispatcher/动作直接run、工具选择及工具实例访问、对话请求与渲染、工具栏/菜单/命令面板、面板事件边界；少量直接写入入口提供paint/fill/adjustment、text warp/path、transform warp、effects/smartObject的通用检查。无embedded/ADA依赖，无插件框架。native读取/编码不依赖此策略，因此收紧新操作不会改写已有合法数据。WP独立入口默认不受限制。

main类型、完整build和access+native定向26/26通过。此阶段仅提交通用seam；embedded仍需实际声明native上限并接产品配置，ADA恢复修复/新包实窗尚未完成，不将R1标为已关闭。