# Release Notes / 发布说明 (v5.0.0)

## 新功能

- 项目转为 Antigravity App 和 Antigravity CLI (`agy`) 的本地会话管理工具, 支持查看, 搜索, 单条和批量删除
- 按来源和会话 ID 清理会话正文, 日志, 注解, 占用锁, 摘要数据库, 全文索引 (删除后重建 FTS5, 压缩数据库并执行 WAL 检查点), protobuf 摘要索引, 最近会话, 摘要缓存和 Antigravity CLI 输入历史, 清理后 CC Switch 不再列出
- 支持清理中断后的自动恢复: 重新打开应用或刷新列表时, 已提交的清理继续收尾, 未提交的清理自动还原
- 列出并可清理只剩索引的残留记录, 包括只存在于 protobuf 摘要索引里的记录
- 批量删除时每个存储目录只处理一遍, 单条失败不影响同批其他会话
- 识别 CC Switch 的 Antigravity CLI 配置目录 (`~/.cc-switch/agy/<profile>/antigravity-cli`)

## 移除

- 移除侧边栏和 Manager 补丁 (Markdown 复制, LaTeX, Mermaid, 表格配色), 补丁安装器和脚本. Google Antigravity 已内置相关能力, 需要旧版补丁请使用 [v4.0.0](https://github.com/mikessslxxx/anti-power/releases/tag/v4.0.0)
- 移除 Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw 的对话浏览和缓存清理

## 依赖

- 升级到 Tauri 2.12, Vite 8, TypeScript 6, vue-i18n 11, rusqlite 0.43, sysinfo 0.40
- 移除 Tailwind CSS, 改用轻量基础样式重置
- 源码构建需要 Node.js 22.12+ 和 Rust 1.95+
- 已核对版本: Antigravity App 2.33.0, Antigravity CLI 1.5.12 (macOS). Windows 和 Linux 安装包尚未实测

---

## New Features

- Anti-Power is now a local session manager for the Antigravity App and the Antigravity CLI (`agy`): browse, search, and delete single or multiple sessions
- Scoped cleanup removes conversation data, logs, annotations, presence lock, summary database rows, full-text index (with FTS5 rebuild, database compaction, and WAL checkpoint), protobuf summary index entries, recent-session/summary caches, and Antigravity CLI prompt history entries for one source and session ID, so CC Switch no longer lists the session
- Automatic recovery for interrupted cleanups: reopening the app or refreshing the list finalizes committed deletions and restores uncommitted ones
- Lists and cleans index-only leftovers, including records present only in the protobuf summary index
- Batch deletion cleans each store in one pass, and one failed session does not block the rest of the batch
- Detects CC Switch profile directories for the Antigravity CLI (`~/.cc-switch/agy/<profile>/antigravity-cli`)

## Removed

- Removed Sidebar and Manager patches (Markdown copy, LaTeX, Mermaid, table colors), the patch installer, and the scripts. Google Antigravity now handles these natively; use [v4.0.0](https://github.com/mikessslxxx/anti-power/releases/tag/v4.0.0) if you still need the patches
- Removed session browsing and cache cleanup for Claude Code, Codex, Gemini CLI, OpenCode, and OpenClaw

## Dependencies

- Upgraded to Tauri 2.12, Vite 8, TypeScript 6, vue-i18n 11, rusqlite 0.43, and sysinfo 0.40
- Removed Tailwind CSS in favor of a minimal base style reset
- Building from source requires Node.js 22.12+ and Rust 1.95+
- Verified against Antigravity App 2.33.0 and Antigravity CLI 1.5.12 on macOS. The Windows and Linux builds are untested

---

## 安装 / Installation

- **Windows**: 下载 `anti-power-windows.exe` 安装运行 / Download and run `anti-power-windows.exe`
- **macOS (Universal)**: 下载 `anti-power-macos-universal.dmg` 安装 (未签名, 首次打开若提示 "已损坏", 运行 `xattr -cr /Applications/Anti-Power.app`) / Download `anti-power-macos-universal.dmg` (unsigned; if macOS reports it is damaged, run `xattr -cr /Applications/Anti-Power.app`)
- **Linux**: 下载 `anti-power-linux.AppImage` 运行 / Download and run `anti-power-linux.AppImage`
