# Release Notes / 发布说明 (v4.0.0)

## 新功能

- 新增对新版 `Antigravity IDE` 安装路径与数据目录命名的识别, 覆盖 Windows/macOS/Linux 与脚本安装/清理流程
- 支持版本更新至 `Antigravity IDE v2.0.6`; Antigravity 从 2.0 起更名为 Antigravity IDE

## 优化

- 优化 Sidebar/Manager 内容扫描, 兼容新版 DOM 结构并减少对输入框, 按钮等控制区的误绑定
- 复制包含 KaTeX/MathJax 公式的选区时自动还原 LaTeX 源码, 旧版侧边栏, 新版侧边栏和 Manager 一致生效
- 清理工具同步覆盖 `.gemini/antigravity-ide` 对话缓存目录

## 修复

- 修复新版 IDE 缺少 legacy `extensions/antigravity` 目录时安装校验过严的问题

## 文档

- README/Changelog/Release Notes 同步至 v4.0.0
- README 支持的 Antigravity IDE 版本更新至 v2.0.6

---

## New Features

- Added detection for new `Antigravity IDE` install and data directory names across Windows/macOS/Linux and script install/cleanup flows
- Updated supported version to `Antigravity IDE v2.0.6`; Antigravity was renamed to Antigravity IDE starting from 2.0

## Improvements

- Improved Sidebar/Manager content discovery for newer DOM structures and reduced accidental binding inside inputs, buttons, and control areas
- Copying selections that include KaTeX/MathJax formulas now restores LaTeX source consistently in the legacy Sidebar, modern Sidebar, and Manager
- Cleanup now also covers `.gemini/antigravity-ide` conversation cache directories

## Fixes

- Fixed overly strict install validation when newer IDE builds no longer include the legacy `extensions/antigravity` directory

## Documentation

- Synced README/Changelog/Release Notes to v4.0.0.
- Updated the supported Antigravity IDE version in README to v2.0.6.

---

## 安装 / Installation

- **Windows**: 下载 `anti-power-windows.exe` 运行
- **macOS (Universal)**: 下载 `anti-power-macos-universal.dmg` 安装
- **Linux**: 下载 `anti-power-linux.AppImage` 运行
- **手动安装**: 下载 `anti-power-patches.zip` 手动安装
