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
