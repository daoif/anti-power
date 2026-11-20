<p align="center">
  <img src="docs/assets/images/LOGO.png" alt="Anti-Power" width="120">
</p>

<h1 align="center">Anti-Power</h1>

<p align="center">
  <a href="https://github.com/mikessslxxx/anti-power/releases"><img src="https://img.shields.io/badge/版本-v5.0.1-blue.svg" alt="版本"></a>
  <img src="https://img.shields.io/badge/Antigravity_App-2.33.0-green.svg" alt="Antigravity App">
  <img src="https://img.shields.io/badge/Antigravity_CLI-1.5.12-green.svg" alt="Antigravity CLI">
</p>

<p align="center">
  中文 | <a href="README_EN.md">English</a>
</p>

> 查看并清理 **Antigravity App** 和 **Antigravity CLI** (`agy`) 的本地会话.

## 功能

- 列出 Antigravity App (`~/.gemini/antigravity`) 和 Antigravity CLI (`~/.gemini/antigravity-cli`) 的会话, 也识别 CC Switch 的 `~/.cc-switch/agy/<profile>/antigravity-cli`
- 按标题, 项目或会话 ID 搜索, 按来源筛选并查看消息
- 单条或批量删除, 逐条显示结果
- 标出只剩索引的残留记录 (其他工具删掉会话文件后留下的), 可照常删除

已在 macOS 上用 Antigravity App 2.33.0 和 Antigravity CLI 1.5.12 核对. Windows 和 Linux 安装包尚未实测. 不支持 Antigravity IDE (`~/.gemini/antigravity-ide`).

## 清理范围

按来源和会话 ID 精确清理, 删除后 CC Switch 等工具刷新也不会再列出:

| 位置 | 内容 |
|------|------|
| `conversations/<id>.db` 及 `-wal`, `-shm`, `-journal`, `<id>.pb` | 会话正文 |
| `brain/<id>/` | 日志和产物 |
| `annotations/<id>.pbtxt`, `presence/<id>.lock` | 注解和占用锁 |
| `conversation_summaries.db` | 摘要, 全文索引, 父子关系 |
| `agyhub_summaries_proto.pb`, `jetbox_summaries_proto.pb` | 摘要索引 |
| `cache/last_conversations.json`, `cache/conversation_metadata.json` | 最近会话和摘要缓存 |
| `history.jsonl` | Antigravity CLI 输入历史中属于该会话的条目 |
| `sidecar_data/<插件>/<面板>/events/*.json` | 插件 sidecar 事件 |
| `sidecar_data/<插件>/<面板>/` 下的 `data/trajectory_usage_cache.json`, `logs/sidecar.log` | Usage Monitor 缓存条目和相关日志行 |
| Antigravity App 数据目录的 `app_storage.json` | 窗口布局和侧栏状态 |

- 子代理会话随所属会话一起删除, `/fork` 出的会话独立保留.
- 同一 ID 可能同时出现在 Antigravity App 和 Antigravity CLI 中, 两边分别显示; 若要一并清除, 需分别勾选.
- Antigravity App 数据目录在 macOS 上是 `~/Library/Application Support/Antigravity`, Windows 上是 `%APPDATA%\Antigravity`, Linux 上是 `~/.config/Antigravity`.
- 不清理运行日志 (`log/`), 也不清理写到 `/tmp` 或项目目录里的文件.
- 清理后会压缩 `conversation_summaries.db`, 库内不留已删记录的片段; 若此时有其他工具正在读取该库, 压缩会被跳过, 片段会留到下次清理. 被删除的文件本身不做磁盘级擦除.

界面上方有两个默认关闭的可选项, 勾选状态会被记住:

- **CC Switch 同步记录**: 从 `~/.cc-switch/` 下的 `cc-switch.db` 及 `backups/*.db` 中删除会话文件的同步进度 (`session_log_sync`), 并压缩数据库. 需先退出 CC Switch. 用量和费用历史 (`proxy_request_logs`, `session_usage_dedup`, `usage_daily_rollups`) 会保留; 它们只含会话 ID, 模型和 token 用量, 不含对话内容.
- **Antigravity App 浏览器缓存**: 清空 Antigravity App 数据目录下的 `Cache/` 和 `Code Cache/`. 这两个目录无法按会话过滤, 可能留有会话 ID; Antigravity App 会自动重建, 下次启动稍慢.

应用数据目录和 CC Switch 的清理在会话删除提交后执行; 若失败, 会话不会回滚, 结果中会列出未清理项.

删除前须退出 Antigravity App 和 Antigravity CLI; Antigravity IDE 运行时同样会拒绝清理. 删除无法撤销.

如果清理中途退出, 关闭上述客户端后重新打开 Anti-Power 或刷新列表: 已提交的清理会继续收尾, 尚未提交的清理会还原; 无法恢复时列表上方会给出提示.

## 用量和额度

推荐直接使用 [antigravity-usage-monitor](https://github.com/yuhuan-dev/antigravity-usage-monitor), 它以 Antigravity 插件的形式安装:

```bash
git clone https://github.com/yuhuan-dev/antigravity-usage-monitor.git ~/.gemini/config/plugins/usage-monitor
```

然后在 Antigravity App 的 **Customizations → Installed** 中启用 `usage-monitor`.

## 安装和运行

在 [Releases](https://github.com/mikessslxxx/anti-power/releases) 下载对应平台的安装包:

- **Windows**: `anti-power-windows.exe`
- **macOS (Universal)**: `anti-power-macos-universal.dmg` (未签名, 首次打开若提示 "已损坏", 运行 `xattr -cr /Applications/Anti-Power.app`)
- **Linux**: `anti-power-linux.AppImage`

从源码运行需要 Node.js 22.12+ 和 Rust 1.95+:

```bash
cd patcher
npm install
npm run tauri:dev
```

## 旧版补丁

Google Antigravity 已内置 LaTeX 和 Mermaid 渲染, 补丁功能已移除. [v4.0.0](https://github.com/mikessslxxx/anti-power/releases/tag/v4.0.0) 是最后一个包含补丁的版本, 支持到 Antigravity IDE v2.0.6.

## 文档

- 更新日志: [CHANGELOG.md](CHANGELOG.md)
- 发布指南: [release-guide.md](docs/guides/release-guide.md)

## 贡献

欢迎提交 Issue 和 Pull Request.

## 致谢

- [@daoif](https://github.com/daoif) (原作者)
- [@syanle](https://github.com/syanle)
- [@Sophomoresty](https://github.com/Sophomoresty)
- [@Wusir7355608](https://github.com/Wusir7355608)
- [@aiaiads](https://github.com/aiaiads)

## 许可证

MIT License
