# Release Notes / 发布说明 (v3.2.2)

## 优化

- 复制提取新增内联 Markdown 语义保留, 支持加粗/斜体/删除线/链接/行内代码
- 新增段落/块引用/水平分割线/显式换行转换规则, 提升复杂内容复制可读性
- 当内容包含内联格式时禁用原始文本缓存直出, 避免格式丢失
- 空行策略改为最多合并为一个空行, 保留段落与标题结构

## 文档

- README/Changelog/Release Notes 同步至 v3.2.2
- README 支持的 Antigravity 版本更新至 v1.19.6

---

## Improvements

- Added inline Markdown semantic preservation in copy extraction, including bold/italic/strikethrough/links/inline code.
- Added conversion rules for paragraphs/blockquotes/horizontal rules/explicit line breaks to improve readability for complex copied content.
- Disabled raw-text fast path when inline formatting exists to avoid losing formatting.
- Updated blank-line handling to collapse consecutive empty lines to at most one while preserving paragraph and heading structure.

## Documentation

- Synced README/Changelog/Release Notes to v3.2.2.
- Updated supported Antigravity version in README to v1.19.6.

---

## 安装 / Installation

- **Windows**: 下载 `anti-power-windows.exe` 运行
- **macOS (Universal)**: 下载 `anti-power-macos-universal.dmg` 安装
- **Linux**: 下载 `anti-power-linux.AppImage` 运行
- **手动安装**: 下载 `anti-power-patches.zip` 手动安装
