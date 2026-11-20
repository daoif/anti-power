# Release Notes / 发布说明 (v5.0.1)

## 新功能

- 删除会话时一并清理插件 `sidecar_data/` 下的事件, Usage Monitor 缓存条目和相关日志行, 与会话文件在同一可恢复清理中提交
- 同步清理 Antigravity App `app_storage.json` 中的窗口布局和侧栏状态
- 新增两个默认关闭的可选项, 勾选状态会被记住:
  - **CC Switch 同步记录**: 删除 `~/.cc-switch/` 下的 `cc-switch.db` 及 `backups/*.db` 中的会话文件同步进度, 保留用量和费用历史 (需先退出 CC Switch)
  - **Antigravity App 浏览器缓存**: 清空 `Cache/` 和 `Code Cache/`, 其中可能留有会话 ID, 会自动重建
- 应用数据目录和 CC Switch 的清理若失败, 会话不会回滚, 结果中会列出未清理项
- 只对之后删除的会话生效, 不处理以前删除留下的残留
- 已核对版本: Antigravity App 2.33.0, Antigravity CLI 1.5.12 (macOS). Windows 和 Linux 安装包尚未实测

---

## New Features

- Deleting a session also removes its plugin `sidecar_data/` events, Usage Monitor cache entry, and matching log lines as part of the same recoverable cleanup
- Also removes the session's window layout and side panel state from the Antigravity App's `app_storage.json`
- Two new options, off by default and remembered:
  - **CC Switch sync records**: removes session file sync progress from `cc-switch.db` and `backups/*.db` under `~/.cc-switch/`, keeping usage and cost history (quit CC Switch first)
  - **Antigravity App browser cache**: empties `Cache/` and `Code Cache/`, which can hold session IDs and are rebuilt automatically
- If app data or CC Switch cleanup fails, the session stays deleted and the result lists what was not cleaned
- Applies to sessions deleted from now on; leftovers from earlier deletions are not cleaned
- Verified against Antigravity App 2.33.0 and Antigravity CLI 1.5.12 on macOS. The Windows and Linux builds are untested

---

## 安装 / Installation

- **Windows**: 下载 `anti-power-windows.exe` 安装运行 / Download and run `anti-power-windows.exe`
- **macOS (Universal)**: 下载 `anti-power-macos-universal.dmg` 安装 (未签名, 首次打开若提示 "已损坏", 运行 `xattr -cr /Applications/Anti-Power.app`) / Download `anti-power-macos-universal.dmg` (unsigned; if macOS reports it is damaged, run `xattr -cr /Applications/Anti-Power.app`)
- **Linux**: 下载 `anti-power-linux.AppImage` 运行 / Download and run `anti-power-linux.AppImage`
