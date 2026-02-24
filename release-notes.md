# Release Notes / 发布说明 (v3.2.0)

## 新功能

- 适配 Antigravity 新版侧边栏入口, 根据 `product.json` 中 `ideVersion` 自动切换旧版/新版补丁路径

## 优化

- 安装器界面新增 Antigravity 版本号显示
- 确认安装弹窗根据侧边栏入口模式动态展示变更文件
- 新版侧边栏样式与 Manager 样式对齐, 修复复制按钮显示细节
- 修复补丁状态回填逻辑, 避免仅安装单模块时误判另一模块为启用

## 文档

- README/Changelog/Release Notes 同步至 v3.2.0
- README 支持的 Antigravity 版本更新至 v1.18.4

---

## New Features

- Adapted to the new Antigravity sidebar entry, with automatic legacy/modern patch path switching based on `ideVersion` in `product.json`.

## Improvements

- Added Antigravity version display in the installer UI.
- Confirmation modal now shows file changes dynamically based on sidebar entry mode.
- Aligned modern sidebar styles with Manager styles and fixed copy-button display details.
- Fixed patch status state sync to avoid incorrectly enabling the other module in single-module installs.

## Documentation

- Synced README/Changelog/Release Notes to v3.2.0
- Updated supported Antigravity version in README to v1.18.4.

---

## 安装 / Installation

- **Windows**: 下载 `anti-power-windows.exe` 运行
- **macOS (Universal)**: 下载 `anti-power-macos-universal.dmg` 安装
- **Linux**: 下载 `anti-power-linux.AppImage` 运行
- **手动安装**: 下载 `anti-power-patches.zip` 手动安装
