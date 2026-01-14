<p align="center">
  <img src="docs/images/LOGO.png" alt="Anti-Power" width="120">
</p>

<h1 align="center">Anti-Power 增强补丁</h1>

<p align="center">
  <a href="https://github.com/daoif/anti-power/releases">
    <img src="https://img.shields.io/badge/版本-v2.0.1-blue.svg" alt="版本">
  </a>
  <a href="https://codeium.com/antigravity">
    <img src="https://img.shields.io/badge/支持_Antigravity-v1.14.2-green.svg" alt="Antigravity">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/协议-MIT-orange.svg" alt="开源协议">
  </a>
</p>

> 🚀 针对 **Antigravity AI IDE** 的增强补丁，让你的 AI 对话体验更上一层楼！

<p align="center">
  💬 <a href="https://qm.qq.com/q/AHUKoyLVKg">QQ 交流群: 993975349</a>
</p>

---

## 🎯 项目愿景

建立这个仓库的初衷是希望**大家一起来共同提升 Antigravity 的使用体验**。

Antigravity 是一款优秀的 AI IDE，但在日常使用中难免会遇到一些小问题或不便之处。我们希望通过社区的力量，收集和分享各种增强补丁、优化技巧，让每一位用户都能获得更好的使用体验。

**欢迎提交你的增强方案！** 无论是样式优化、功能增强还是使用技巧，都可以通过 Issue 或 Pull Request 分享给大家。

---

## 🖼️ 工具预览

<p align="center">
  <img src="docs/images/patcher-screenshot.png" alt="Anti-Power Patcher" width="400">
</p>

---
## ✨ 功能特性

| 功能 | 描述 |
|------|------|
| 🎨 **Mermaid 渲染** | 自动渲染流程图、时序图、类图等，支持深色主题 |
| 📐 **数学公式渲染** | 支持 `$...$` 行内公式和 `$$...$$` 块级公式 |
| 📋 **一键复制** | Copy 按钮复制 AI 返回内容，自动转 Markdown |
| 🎯 **表格颜色修复** | 修复深色主题下表格文字不可见问题 |
| 👆 **悬浮复制按钮** | 内容区域右上角悬浮按钮，不影响阅读 |

### 复制功能亮点

- 📝 代码块自动带语言标识（如 ` ```python `）
- 📊 表格自动转换为 Markdown 表格格式
- 🧠 智能忽略 AI 中间思考过程，只复制最终结果
- 📎 公式和 Mermaid 自动还原为源码

---

## 📸 效果展示

### 🎨 Mermaid 流程图渲染

原版 Antigravity 只能显示 Mermaid 源代码，安装补丁后可以直接渲染为精美的流程图：

![Mermaid 增强效果](docs/images/5.png)

<details>
<summary>👀 查看原版效果（点击展开）</summary>

![Mermaid 原版效果](docs/images/6.png)

</details>

---

### 📐 数学公式渲染

原版只能显示 LaTeX 源码，补丁启用后自动渲染为标准数学公式：

![公式增强效果](docs/images/3.png)

<details>
<summary>👀 查看原版效果（点击展开）</summary>

![公式原版效果](docs/images/4.png)

</details>

---

### 📋 一键复制 & 表格优化

新增 **Copy** 按钮，一键复制 AI 返回内容为 Markdown 格式，同时修复表格颜色问题：

![复制按钮展示](docs/images/2.png)

复制后的内容自动转换为规范的 Markdown 格式，可直接粘贴到其他编辑器：

![复制内容展示](docs/images/1.png)

---



## 📥 下载安装

### Windows（推荐）

1. 前往 [Releases 页面](https://github.com/daoif/anti-power/releases) 下载 `anti-power.exe`
2. 双击运行，**无需安装**
3. 程序会自动检测 Antigravity 安装路径
4. 选择需要的功能，点击「安装补丁」即可
5. 重启antigravity,或另外打开一个antigravity窗口查看效果

> ⚠️ **当前仅支持 Windows 系统**

### macOS

macOS 版本正在开发中，敬请期待！

如需在 macOS 上使用，可参考下方手动安装方式（使用 [v1.2.1](https://github.com/daoif/anti-power/releases/tag/v1.2.1) 旧版本）。

<details>
<summary><b>📁 macOS 手动安装方式（旧版）</b></summary>

1. 下载 [v1.2.1](https://github.com/daoif/anti-power/releases/tag/v1.2.1) 的 `cascade-panel.html`
2. 打开 **"应用程序 (Applications)"** 文件夹
3. 右键点击 **Antigravity.app** → **"显示包内容 (Show Package Contents)"**
4. 进入 `Contents/Resources/app/extensions/antigravity/`
5. 备份原始 `cascade-panel.html`
6. 用下载的文件替换
7. 重启 Antigravity

</details>

---

## 📋 版本信息

| 补丁版本 | 支持的 Antigravity 版本 | 发布日期 | 更新内容 |
|---------|------------------------|----------|----------|
| v2.0.1  | v1.14.2                | 2026-01-14 | 性能优化，感谢 @mikessslxxx |
| v2.0.0  | v1.14.2                | 2026-01-14 | 新增 Tauri 工具，支持功能单独开关 |
| v1.2.1  | v1.13.3                | 2026-01-13 | Bug 修复 |
| v1.2.0  | v1.13.3                | 2026-01-13 | Mermaid 渲染 |
| v1.1.0  | v1.13.3                | 2026-01-13 | 数学公式渲染 |
| v1.0.0  | v1.13.3                | 2026-01-13 | 一键复制、表格修复 |

---

## ⚠️ 注意事项

- **更新覆盖**：Antigravity 官方更新后，此修改可能会被覆盖，需要重新应用补丁
- **版本兼容**：建议在使用前确认 Antigravity 版本号与支持版本一致
- **备份习惯**：每次替换前请务必备份原文件，以便需要时恢复
- **已知问题**：部分功能存在已知限制，详见 [已知问题文档](docs/KNOWN_ISSUES.md)

---

## 📚 参考资料

本项目的表格颜色修复方案参考了以下教程：

- 📺 **视频教程**：[Antigravity 完美深色主题修改指南](https://www.bilibili.com/video/BV1vTrgBXEA1)
- 📖 **图文教程**：[表格文字看不清的终极解决方案](https://dpit.lib00.com/zh/content/1192/antigravity-perfect-dark-theme-modification-guide-fix-invisible-table-text)

---

## 🙏 致谢

感谢以下贡献者对本项目的支持：

- [@mikessslxxx](https://github.com/mikessslxxx) - v1.1.0 数学公式渲染、v2.0.1 性能优化

---

## 📄 开源协议

MIT License

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

<p align="center">
  💡 如果这个项目对你有帮助，欢迎 Star ⭐
</p>
