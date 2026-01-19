# AGENTS.md（Anti-Power 项目关键上下文）

> 目标：让 AI 一眼理解本项目在做什么、补丁如何落地、关键入口在哪里。

## 项目定位
- Anti-Power 是 Antigravity AI IDE 的增强补丁。
- 主要增强侧边栏对话区域（cascade-panel）：Mermaid 渲染、数学公式渲染、一键复制、表格颜色修复、字体大小控制等。
- 当前重点支持 Windows；macOS 仅旧版手动安装流程（见 `README.md`）。

## 补丁落地流程（核心链路）
1. 桌面安装器位于 `patcher/`（Tauri + Vue）。
2. Rust 后端负责：检测安装路径、安装/卸载、更新配置（`patcher/src-tauri/src/commands/*.rs`）。
3. 安装时会：
   - 备份 `resources/app/extensions/antigravity/cascade-panel.html` 为 `.bak`
   - 写入补丁文件与 `cascade-panel/` 目录
   - 生成 `cascade-panel/config.json`（功能开关）
4. 补丁文件来源于 `patcher/patches/`，并通过 `patcher/src-tauri/src/embedded.rs` 以 `include_str!` 嵌入二进制。

## 关键目录（修改点优先级）
- `patcher/patches/`：真正注入到 Antigravity 的补丁源文件（HTML/JS/CSS）。
- `patcher/src-tauri/`：安装器后端逻辑（路径检测、备份/写入、配置）。
- `patcher/src/`：安装器前端 UI（功能开关、安装/卸载按钮）。
- `docs/`：开发/发布/已知问题（`developer-guide.md`、`release-guide.md`、`KNOWN_ISSUES.md`）。
- `tests/`：Playwright 脚本，用于远程调试 Antigravity 的 Manager 窗口 DOM。
- `patcher/patches/workbench-jetski-agent.html` + `patcher/patches/manager-panel/`：Manager 窗口补丁入口与模块。

## Antigravity 内部 Hook 点
- 侧边栏：`resources/app/extensions/antigravity/cascade-panel.html`
- Manager 窗口：`resources/app/out/vs/code/electron-browser/workbench/workbench-jetski-agent.html`
- 注意：修改 `workbench-jetski-agent.html` 会触发“扩展已损坏”提示，但不影响使用。

## 运行逻辑速览（侧边栏补丁）
- 入口：`patcher/patches/cascade-panel.html` → `cascade-panel/cascade-panel.js`
- `cascade-panel.js` 读取 `config.json`，按需加载模块并启动扫描。
- `scan.js` 基于 DOM 监听与内容稳定性判断触发渲染与复制按钮注入。

## 构建与发布（安装器）
- 在 `patcher/` 下：
  - `npm run tauri:dev`
  - `npm run tauri:build`
- 发布前需同步版本号：`patcher/package.json`、`patcher/src-tauri/tauri.conf.json`、`patcher/src-tauri/Cargo.toml`、`patcher/src/App.vue`、`README.md`（详见 `docs/release-guide.md`）。

## 重要约束/风险
- 新增或删除补丁文件时，必须同步更新 `patcher/src-tauri/src/embedded.rs` 的嵌入列表。
- Antigravity 官方更新会覆盖补丁，需要重新安装。
- 已知问题：表格内含 `|` 的 LaTeX 公式渲染异常（`docs/KNOWN_ISSUES.md`）。
