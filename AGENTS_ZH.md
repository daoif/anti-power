# AGENTS_ZH.md (Anti-Power 项目关键上下文)

[English](AGENTS.md) | 中文

> 目标: 让 AI 一眼理解本项目在做什么, 补丁如何落地, 关键入口在哪里.

## 项目定位

- Anti-Power 是 Antigravity AI IDE 的增强补丁.
- 主要增强侧边栏对话区域和 Manager 窗口: Mermaid 渲染, 数学公式渲染, 一键复制, 表格颜色修复, 字体大小控制等.
- 侧边栏补丁支持新旧双入口, 按 `product.json.ideVersion` 自动切换:
  - Legacy (< 1.18.3): `extensions/antigravity/cascade-panel.html` + `cascade-panel/`
  - Modern (>= 1.18.3): `out/vs/code/electron-browser/workbench/workbench.html` + `sidebar-panel/`
- 现已支持 Windows/macOS/Linux; 在 macOS/Linux 上可使用安装器产物或 `patcher/patches/anti-power.sh`, 也可走手动安装流程 (见 `README.md` / `patcher/patches/manual-install.md`).
- 在 macOS/Linux 上, 安装器可能需要提权 (sudo/pkexec) 才能写入 `resources/app` 下的文件.

## 补丁落地流程 (核心链路)

1. 桌面安装器位于 `patcher/` (Tauri + Vue).
2. Rust 后端负责: 检测安装路径, 安装/卸载, 更新配置 (`patcher/src-tauri/src/commands/*.rs`).
3. 安装时会:
   - 备份侧边栏与 Manager 入口文件为 `.bak` (按入口模式):
     - 旧版侧边栏: `resources/app/extensions/antigravity/cascade-panel.html`
     - 新版侧边栏: `resources/app/out/vs/code/electron-browser/workbench/workbench.html`
     - Manager: `resources/app/out/vs/code/electron-browser/workbench/workbench-jetski-agent.html`
   - 写入补丁文件与目录:
     - 侧边栏 (旧版): `cascade-panel.html` + `cascade-panel/`
     - 侧边栏 (新版): `workbench.html` + `sidebar-panel/`
     - `workbench-jetski-agent.html` + `manager-panel/`
   - 生成配置文件 (功能开关):
     - 侧边栏配置路径按模式决定 (`cascade-panel/config.json` 或 `sidebar-panel/config.json`)
     - `manager-panel/config.json`
   - 如启用 Manager 补丁, 会从 `resources/app/product.json` 中移除相关 checksums, 避免出现"安装似乎损坏"提示.
4. 补丁文件来源于 `patcher/patches/`, 嵌入清单由 `patcher/src-tauri/build.rs` 自动生成 (排除列表 `patcher/patches/.embed-exclude.txt`), `patcher/src-tauri/src/embedded.rs` 通过 `include!` 引入清单.

## 关键目录 (修改点优先级)

- `patcher/patches/`: 注入到 Antigravity 的补丁源文件 (HTML/JS/CSS).
- `patcher/src-tauri/`: 安装器后端逻辑 (路径检测, 备份/写入, 配置).
- `patcher/src/`: 安装器前端 UI (功能开关, 安装/卸载按钮).
- `.github/workflows/`: 构建与发布流水线 (包含 macOS Universal 构建产物).
- `docs/`: 开发, 发布, 结构, 已知问题与截图 (见 `docs/README.md`).
- `docs/guides/developer-guide.md`: 完整的中文开发者文档, 包含 DOM 结构, 代码规范, 开发流程.
- `tests/scripts/`: Playwright 脚本, 用于远程调试 Antigravity 的 Manager 窗口 DOM.
- `patcher/patches/manual-install.md`: 随补丁压缩包提供的手动安装说明 (Windows/macOS/Linux).
- `patcher/patches/workbench.html` + `patcher/patches/sidebar-panel/`: 新版侧边栏补丁入口与模块.
- `patcher/patches/workbench-jetski-agent.html` + `patcher/patches/manager-panel/`: Manager 窗口补丁入口与模块.

## Antigravity 内部 Hook 点

- 侧边栏 (旧版): `resources/app/extensions/antigravity/cascade-panel.html`
- 侧边栏 (新版): `resources/app/out/vs/code/electron-browser/workbench/workbench.html`
- Manager 窗口: `resources/app/out/vs/code/electron-browser/workbench/workbench-jetski-agent.html`
- ~~注意: 修改 `workbench-jetski-agent.html` 会触发 "扩展已损坏" 提示~~ (v2.3.2+ 已修复)

## 运行逻辑速览 (侧边栏补丁)

- 旧版入口: `patcher/patches/cascade-panel.html` -> `cascade-panel/cascade-panel.js`
- 新版入口: `patcher/patches/workbench.html` -> `sidebar-panel/sidebar-panel.js`
- 两套侧边栏模块都会读取 `config.json`, 按需加载模块并启动扫描.
- `scan.js` 基于 DOM 监听与内容稳定性判断触发渲染与复制按钮注入.

## 构建与发布 (安装器)

- 在 `patcher/` 下:
  - `npm run tauri:dev`
  - `npm run tauri:build`
- 发布前需同步版本号: `patcher/package.json`, `patcher/src-tauri/tauri.conf.json`, `patcher/src-tauri/Cargo.toml`, `patcher/src/App.vue`, `README.md` (详见 `docs/guides/release-guide.md`).

## 重要约束/风险

- 嵌入清单由 build.rs 自动生成, 新增/删除补丁文件时确认 `.embed-exclude.txt` 是否需要更新 (如 `config.json`, 文档).
- 安装逻辑按模式使用白名单:
  - 侧边栏旧版: `cascade-panel.html` + `cascade-panel/`
  - 侧边栏新版: `workbench.html` + `sidebar-panel/`
  - Manager: `workbench-jetski-agent.html` + `manager-panel/`
- Manager 补丁会清理 `resources/app/product.json` 内的 checksums; 如未来补丁修改更多核心文件, 可能需要扩展 `patcher/src-tauri/src/commands/patch.rs` 中的清理列表.
- Antigravity 官方更新会覆盖补丁, 需要重新安装.
- 已知问题: 表格内含 `|` 的 LaTeX 公式渲染异常 (见 `docs/reference/known-issues.md`).

## 开发注意事项 (工具/环境)

- 文档统一使用英文标点符号 (中英文内容都使用英文标点), 避免中文标点导致工具处理异常.
- `apply_patch` 在中文内容较长时可能触发 `byte index ... is not a char boundary`, 导致补丁失败.
  - 解决: 使用提权 PowerShell `Set-Content -Encoding UTF8` 直接写入, 或先写 ASCII 再分段追加.
- 写入 `patcher/patches/` 或清理 `tests/` 在沙箱下可能 `Access denied`, 需要使用提权命令执行写入/删除.

## 近期变更 (v2.3.1 - v3.2.1)

- macOS/Linux 跨平台支持 + 路径规范化与检测; Unix 提权安装流程 (sudo/pkexec)
- 发布产物支持 macOS Universal (Intel/Apple Silicon)
- Manager 补丁通过清理 `product.json` checksums 避免"安装似乎损坏"提示
- 侧边栏补丁支持新旧入口分流, 并按 `ideVersion` 自动切换
- KaTeX CSS/JS 并行加载; 复制按钮更多自定义与布局优化
- Markdown 复制质量提升: 嵌套列表/代码块/内联代码, SVG 过滤, 多余空行清理
- LaTeX/Mermaid 渲染链路增强: 加载失败可重试, 流式更新可重渲染, 并清理 Mermaid 调试日志
- Unix 提权安装与清理脚本改为唯一临时路径并自动回收, 卸载恢复后同步清理 `.bak` 备份残留
