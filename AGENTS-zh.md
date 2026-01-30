# AGENTS.md (Anti-Power 项目关键上下文)

[English](AGENTS.md) | 中文

> 目标: 让 AI 一眼理解本项目在做什么, 补丁如何落地, 关键入口在哪里.

## 项目定位

- Anti-Power 是 Antigravity AI IDE 的增强补丁.
- 主要增强侧边栏对话区域 (cascade-panel) 和 Manager 窗口: Mermaid 渲染, 数学公式渲染, 一键复制, 表格颜色修复, 字体大小控制等.
- 当前重点支持 Windows, macOS 仅手动安装流程 (见 `README.md` / `patcher/patches/manual-install.md`).

## 补丁落地流程 (核心链路)

1. 桌面安装器位于 `patcher/` (Tauri + Vue).
2. Rust 后端负责: 检测安装路径, 安装/卸载, 更新配置 (`patcher/src-tauri/src/commands/*.rs`).
3. 安装时会:
   - 备份 `resources/app/extensions/antigravity/cascade-panel.html` 为 `.bak`
   - 写入补丁文件与 `cascade-panel/` 目录
   - 生成 `cascade-panel/config.json` (功能开关)
4. 补丁文件来源于 `patcher/patches/`, 嵌入清单由 `patcher/src-tauri/build.rs` 自动生成 (排除列表 `patcher/patches/.embed-exclude.txt`), `patcher/src-tauri/src/embedded.rs` 通过 `include!` 引入清单.

## 关键目录 (修改点优先级)

- `patcher/patches/`: 注入到 Antigravity 的补丁源文件 (HTML/JS/CSS).
- `patcher/src-tauri/`: 安装器后端逻辑 (路径检测, 备份/写入, 配置).
- `patcher/src/`: 安装器前端 UI (功能开关, 安装/卸载按钮).
- `docs/`: 开发, 发布, 结构, 已知问题与截图 (见 `docs/README.md`).
- `docs/guides/developer-guide-zh.md`: 完整的中文开发者文档, 包含 DOM 结构, 代码规范, 开发流程.
- `tests/scripts/`: Playwright 脚本, 用于远程调试 Antigravity 的 Manager 窗口 DOM.
- `patcher/patches/manual-install.md`: 随补丁压缩包提供的手动安装说明 (Windows/macOS).
- `patcher/patches/workbench-jetski-agent.html` + `patcher/patches/manager-panel/`: Manager 窗口补丁入口与模块.

## Antigravity 内部 Hook 点

- 侧边栏: `resources/app/extensions/antigravity/cascade-panel.html`
- Manager 窗口: `resources/app/out/vs/code/electron-browser/workbench/workbench-jetski-agent.html`
- 注意: 修改 `workbench-jetski-agent.html` 会触发 "扩展已损坏" 提示, 但不影响使用.

## 运行逻辑速览 (侧边栏补丁)

- 入口: `patcher/patches/cascade-panel.html` -> `cascade-panel/cascade-panel.js`
- `cascade-panel.js` 读取 `config.json`, 按需加载模块并启动扫描.
- `scan.js` 基于 DOM 监听与内容稳定性判断触发渲染与复制按钮注入.

## 构建与发布 (安装器)

- 在 `patcher/` 下:
  - `npm run tauri:dev`
  - `npm run tauri:build`
- 发布前需同步版本号: `patcher/package.json`, `patcher/src-tauri/tauri.conf.json`, `patcher/src-tauri/Cargo.toml`, `patcher/src/App.vue`, `README.md` (详见 `docs/guides/release-guide.md`).

## 重要约束/风险

- 嵌入清单由 build.rs 自动生成, 新增/删除补丁文件时确认 `.embed-exclude.txt` 是否需要更新 (如 `config.json`, 文档).
- 安装逻辑使用白名单: 侧边栏仅 `cascade-panel.html` + `cascade-panel/`, Manager 仅 `workbench-jetski-agent.html` + `manager-panel/`.
- Antigravity 官方更新会覆盖补丁, 需要重新安装.
- 已知问题: 表格内含 `|` 的 LaTeX 公式渲染异常 (见 `docs/reference/known-issues.md`).

## 开发注意事项 (工具/环境)

- 文档统一使用英文标点符号 (中英文内容都使用英文标点), 避免中文标点导致工具处理异常.
- `apply_patch` 在中文内容较长时可能触发 `byte index ... is not a char boundary`, 导致补丁失败.
  - 解决: 使用提权 PowerShell `Set-Content -Encoding UTF8` 直接写入, 或先写 ASCII 再分段追加.
- 写入 `patcher/patches/` 或清理 `tests/` 在沙箱下可能 `Access denied`, 需要使用提权命令执行写入/删除.

## 最新增强 (v2.3.x)

- KaTeX CSS 和 JS 并行加载, 加快首次公式渲染速度
- 右下角常驻复制按钮; 移除 good/bad 反馈区域的复制按钮
- 右上角复制按钮上移, 避免遮挡文字
- 嵌套列表支持, 代码块语言标识正确识别
- 内联代码 (`pre.inline`) 正确提取为反引号格式
- SVG 标签过滤, 避免复制内容包含图标代码
- 清理复制内容中的多余空行
- Manager 功能 (mermaid, math) 默认启用
