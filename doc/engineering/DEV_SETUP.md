# 开发环境与本地配置

2026-11-05 核对。原作者详细开发/打包说明保留在 [docs/DEVELOPMENT.md](../../docs/DEVELOPMENT.md), 本页只维护 fork 与机器相关差异。

## 仓库

- 当前目录: `D:/00_Projects_WSY/AI/Codex_Projects/WebPainter`。
- origin: `https://github.com/MarcleWright/WebPainter.git`, 默认推送目标。
- upstream: `https://github.com/puripooh5-cloud/celenne-studio.git`, fetch 保留, 本地 pushurl 为 DISABLED。
- 初始化后 main 跟踪 origin/main, 两者同在 `a6599003`; 这是当时状态, 后续以 git 为准。
- 原试用目录 temp/celenne-studio 留作原件, 不再作为 WebPainter 开发目录。

只读检查:

```powershell
git status --short
git remote -v
git branch -vv
```

## 安装、运行与构建

要求 Node 22+, 本机验证过 Node 22.23.1 / npm 10.9.8。锁文件优先:

```powershell
npm ci --no-audit --no-fund
npm run build
npm start
```

开发入口: `npm run dev` 为浏览器, `npm run dev:electron` 为桌面开发。完整说明见上游开发文档。

### 启动当前源码的完整工程

双击仓库根目录 [Start-WebPainter.bat](../../Start-WebPainter.bat)。入口自动构建本目录当前 Electron main/preload, 通过本地 Vite 加载当前前端源码, 支持场景按实际能力默认启用 GPU 移动。打开的是完整桌面编辑器, 不创建合成图片; 可自行新建或打开文件, 沿用原生文件对话框与读写服务。

- 不要求先运行 npm run build, 不加载旧 dist 前端或 temp/celenne-studio 副本。界面品牌仍保留 Celenne, 不代表源码来自旧目录。
- userData 和 temp 独立放在本地忽略的 `doc/material/local/current-source/`, 与普通安装和固定样例测试窗口分开, 避免回到其他同名副本。
- 该入口读取正常用户偏好, 不强制修改自动保存; 未支持的格式/图层组合仍按现有规则回退, 原因输出在启动命令窗口。保存/导出会先结束目标 Move; 自动保存跳过拖动目标。人工体验仍待验收。
- 关闭编辑器后对应开发服务结束。普通 npm start、dev:electron 和生产包采用相同能力判断。

历史入口验证（默认接入前）: 2026-11-06 已实际通过该 bat 启动, 确认 enabled=true、nativeBridge=true、autosaveMinutes=0、renderer=webgpu (GPU compositing)、sessions=0。这证明当前源码、原生桥与初始配置, 不等于重新完成文件读写或完整人工场景验收。

### Task 02 手动体验

双击仓库根目录 [Start-Task02.bat](../../Start-Task02.bat), 无需先 build 或另开开发服务。依赖需已安装, 使用本地 Vite 和 Electron 打开独立窗口; 关闭窗口后服务随之结束, 启动失败时命令窗口保留错误信息。

- 默认按能力选路, 使用既有 evaluate.js 的非均匀 3840 x 2160 RGB 8 位测试图, 25% 缩放, 预选中 1536 x 1024 区域。按 V 或保持当前 Move 工具, 在选区内部拖动。
- 已移除 F6 模式切换; F7 重建中选区 C0, F8 重建大选区 C0, F9 重建蒙版/Multiply/opacity/Curves 组合 C1。前后对比需使用固定旧提交与独立 worktree。
- 窗口标题显示模式和后端, F12 打开诊断。预期后端为 `webgpu (GPU compositing)`; 不满足时入口报错, 不把旧路径误认为优化已生效。不支持的图层/格式仍按原型规则回退, 原因输出在启动命令窗口。
- 独立 userData 为本地忽略的 `doc/material/local/task02/manual-profile/`, 自动保存关闭。只作临时测试, 不覆盖常用 profile; 保持使用合成样例, 不把保存/导出并发视为已验收。
- 普通 `npm run build` + `npm start` 已默认按实际能力使用优化, 无实验标记。

历史样例验证（默认接入前）: 2026-11-06 已运行该 bat, 确认 WebGPU 合成、开关开启、4K 样例和自动保存关闭。未据此确认实际拖动体验、30fps 或用户验收; 性能结论仍见任务 02。

本机初始化时 npm ci 安装了依赖但未下载 Electron dist; 已把之前校验过、相同版本 44.4.5 的运行时独立复制到本目录, 没有链接依赖旧目录。再次 npm ci 后若缺少运行时, 可先按包提供的方法安装:

```powershell
node node_modules/electron/install.js
```

遇到网络或下载失败需核对版本与 SHA256, 不以随意替换运行时规避失败。部分构建过程有上游 WASM/Node 兼容性警告, 本机 build 成功不等于全部格式功能已验收。

## 本地注意事项

- 本机部分端口可能被 Windows 保留, 即使未监听也可能 EACCES。浏览器开发可另选可绑定端口; 桌面开发脚本的服务 URL 也需相应核对, 不盲目终止其他进程。
- 多个同名 Celenne 副本可能通过 single-instance lock 回到已运行窗口。做测试时使用独立 profile, 不强制关闭用户未保存的文档。
- 本地 smoke 入口和日志在 `.local-artifacts/`, 已通过本仓库 `.git/info/exclude` 忽略。它们不随 clone 自动恢复。
- 当前 app identity/图标仍为上游; 品牌替换是后续工作。源码许可和独立第三方模块许可保持原状。
- 更新服务器和错误报告目标当前为空, 构建显示关闭。没有运行发布、Git 推送或真实 AI 服务验证。

## 已验证的范围

npm ci、生产 build 和隔离生产窗口 smoke 已通过。自带 `14-complex-professional.psd` 打开显示 10 层, 无加载错误; 文档仅 96 x 64。完整测试、包装安装、用户正式验收和全离线验证未由此证明。
