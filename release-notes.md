# Release Notes / 发布说明 (v3.2.1)

## 优化

- LaTeX 渲染支持流式增量更新重渲染, 修复内容更新后无法刷新问题
- Mermaid/KaTeX 资源加载失败后支持自动重试, 提升弱网和偶发失败场景稳定性
- 复制成功反馈改为定时器去重, 减少连续点击时按钮闪烁
- 移除 Sidebar/Manager Mermaid 调试日志, 降低控制台噪音

## 修复

- 修复 `$...$` 公式内 `_`/`__` 被 Markdown 强调标签拆分后导致的下划线丢失
- 修复 Sidebar Mermaid Trusted Types policy 名称, 与 `sidebarPanel` CSP 白名单保持一致
- 修复 Unix 提权安装与清理流程中的临时目录/脚本命名冲突风险
- 卸载恢复后自动清理 `.bak` 备份文件, 避免残留
- 配置路径解析新增 `~/.config` 回退, 提升 Linux 兼容性

## 文档

- README/Changelog/Release Notes 同步至 v3.2.1

---

## Improvements

- LaTeX rendering now supports re-render on streaming incremental updates, fixing stale output after content changes.
- Mermaid/KaTeX load failures now retry automatically, improving resilience under unstable network conditions.
- Copy-success feedback now deduplicates timers to reduce button flicker during rapid clicks.
- Removed Sidebar/Manager Mermaid debug logs to reduce console noise.

## Fixes

- Fixed underscore loss in `$...$` formulas when `_`/`__` tokens were split by Markdown emphasis tags.
- Fixed Sidebar Mermaid Trusted Types policy naming to align with the `sidebarPanel` CSP allowlist.
- Fixed temp directory/script naming collision risks in Unix privileged install and cleanup flows.
- Auto-clean `.bak` backup files after uninstall restore.
- Added `~/.config` fallback in config path resolution for better Linux compatibility.

## Documentation

- Synced README/Changelog/Release Notes to v3.2.1.

---

## 安装 / Installation

- **Windows**: 下载 `anti-power-windows.exe` 运行
- **macOS (Universal)**: 下载 `anti-power-macos-universal.dmg` 安装
- **Linux**: 下载 `anti-power-linux.AppImage` 运行
- **手动安装**: 下载 `anti-power-patches.zip` 手动安装
