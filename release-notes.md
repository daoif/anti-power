# Release Notes / 发布说明 (v3.3.2)

## 修复

- 修复最新 Antigravity + 最新插件激活后 Manager 显示异常 (图标文字化, 布局异常), 同步 `workbench-jetski-agent.html` 入口模板的 CSP/Trusted Types 与上游保持一致
- 同步新版侧边栏 `workbench.html` 入口模板 CSP 白名单, 避免同类字体/图标资源策略变更导致的异常

## 文档

- README/Changelog/Release Notes 同步至 v3.3.2

---

## Fixes

- Fixed abnormal Manager UI rendering on the latest Antigravity (icons showing raw ligature names and layout issues) by syncing the patched `workbench-jetski-agent.html` CSP/Trusted Types allowlists to upstream
- Synced modern Sidebar `workbench.html` CSP allowlists to upstream to prevent similar font/icon resource regressions

## Documentation

- Synced README/Changelog/Release Notes to v3.3.2.

---

## 安装 / Installation

- **Windows**: 下载 `anti-power-windows.exe` 运行
- **macOS (Universal)**: 下载 `anti-power-macos-universal.dmg` 安装
- **Linux**: 下载 `anti-power-linux.AppImage` 运行
- **手动安装**: 下载 `anti-power-patches.zip` 手动安装
