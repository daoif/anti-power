# Release Notes / 发布说明 (v3.2.3)

## 优化

- Windows 清理工具新增 `sqlite3` 可执行文件自动解析, 除 PATH 外支持 Chocolatey/Git for Windows/Scoop/WinGet 常见安装路径
- 启动时优先对已保存的 Antigravity 路径做规范化与状态刷新, 减少路径已配置但状态未回填的问题

## 修复

- 自动检测路径失败时, 保留用户已保存路径, 避免启动后路径输入被清空

## 文档

- README/Changelog/Release Notes 同步至 v3.2.3

---

## Improvements

- Windows cleaning now auto-resolves the `sqlite3` executable, with support for common install locations beyond PATH (Chocolatey/Git for Windows/Scoop/WinGet).
- On startup, the installer now normalizes the saved Antigravity path and refreshes install state first, reducing path-state mismatch issues.

## Fixes

- Preserved the user-saved path when auto-detection fails, preventing the path field from being cleared on launch.

## Documentation

- Synced README/Changelog/Release Notes to v3.2.3.

---

## 安装 / Installation

- **Windows**: 下载 `anti-power-windows.exe` 运行
- **macOS (Universal)**: 下载 `anti-power-macos-universal.dmg` 安装
- **Linux**: 下载 `anti-power-linux.AppImage` 运行
- **手动安装**: 下载 `anti-power-patches.zip` 手动安装
