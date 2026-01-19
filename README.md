<p align="center">
  <img src="docs/images/LOGO.png" alt="Anti-Power" width="120">
</p>

<h1 align="center">Anti-Power 增强补丁</h1>

<p align="center">
  <a href="https://github.com/daoif/anti-power/releases">
    <img src="https://img.shields.io/badge/版本-v2.1.0-blue.svg" alt="版本">
  </a>
  <a href="https://codeium.com/antigravity">
    <img src="https://img.shields.io/badge/支持_Antigravity-v1.14.2-green.svg" alt="Antigravity">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/协议-MIT-orange.svg" alt="开源协议">
  </a>
</p>

> **Antigravity AI IDE** 对话界面补丁。

<p align="center">
  💬 <a href="https://qm.qq.com/q/AHUKoyLVKg">QQ 交流群: 993975349</a>
</p>

---


## 🖼️ 工具预览

<p align="center">
  <img src="docs/images/patcher-screenshot.png" alt="Anti-Power Patcher" width="400">
</p>

---
## ✨ 功能特性

| 功能 | 描述 |
|------|------|
| **Mermaid 渲染** | 自动渲染流程图、时序图和类图等，支持深色主题 |
| **数学公式渲染** | 支持 `$...$` 行内公式和 `$$...$$` 块级公式 |
| **一键复制** | 用侧边栏或 Manager 的 Copy 按钮将回复复制为 Markdown |
| **表格颜色修复** | 修复深色主题下表格文字不可见问题 |
| **悬浮复制按钮** | 鼠标悬停时在内容区右上角显示 |

### 复制功能

- 📝 代码块自动带语言标识（如 ` ```python `）
- 📊 自动将表格转为 Markdown
- 🧠 仅复制 AI 的最终回复，跳过中间思考过程
- 📎 公式和 Mermaid 自动还原为源码

---

## 📸 效果展示

### 🎨 Mermaid 流程图渲染

原版 Antigravity 显示 Mermaid 源码。安装补丁后，可直接渲染流程图。

![Mermaid 增强效果](docs/images/5.png)

<details>
<summary>👀 查看原版效果（点击展开）</summary>

![Mermaid 原版效果](docs/images/6.png)

</details>

---

### 📐 数学公式渲染

原版显示 LaTeX 源码。启用补丁后，公式会自动渲染。

![公式增强效果](docs/images/3.png)

<details>
<summary>👀 查看原版效果（点击展开）</summary>

![公式原版效果](docs/images/4.png)

</details>

---

### 📋 一键复制 & 表格优化

**Copy** 按钮可将 AI 回复复制为 Markdown。补丁也修复了表格颜色。

![复制按钮展示](docs/images/2.png)

复制的 Markdown 可以直接粘贴到其他编辑器。

![复制内容展示](docs/images/1.png)

---



## 📥 下载安装

### Windows（推荐）

1. 前往 [Releases 页面](https://github.com/daoif/anti-power/releases) 下载 `anti-power.exe`
2. 双击运行，**无需安装**
3. 安装器自动检测 Antigravity 安装路径
4. 选择需要的功能，点击「安装补丁」
5. 重启 Antigravity，或另开一个 Antigravity 窗口查看效果

> ⚠️ **当前仅支持 Windows 系统**

### macOS

macOS 版仍在开发中。

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
| v2.1.0  | v1.14.2                | 2026-01-19 | 侧边栏字体调节、Mermaid 报错提示优化、Manager 一键复制 |
| v2.0.1  | v1.14.2                | 2026-01-14 | 性能优化，感谢 @mikessslxxx |
| v2.0.0  | v1.14.2                | 2026-01-14 | 新增 Tauri 工具，支持功能单独开关 |
| v1.2.1  | v1.13.3                | 2026-01-13 | Bug 修复 |
| v1.2.0  | v1.13.3                | 2026-01-13 | Mermaid 渲染 |
| v1.1.0  | v1.13.3                | 2026-01-13 | 数学公式渲染 |
| v1.0.0  | v1.13.3                | 2026-01-13 | 一键复制、表格修复 |

---

## ⚠️ 注意事项

- **更新覆盖**：Antigravity 更新可能覆盖补丁。若被覆盖，请重新安装。
- **版本兼容**：建议使用前核对当前 Antigravity 版本是否与支持版本一致。
- **备份文件**：每次替换前先备份原文件，以便恢复。
- **已知问题**：部分功能存在已知限制，详见 [已知问题文档](docs/KNOWN_ISSUES.md)

---

## 表格颜色修复参考

- 📺 **视频教程**：[Antigravity 完美深色主题修改指南](https://www.bilibili.com/video/BV1vTrgBXEA1)
- 📖 **图文教程**：[表格文字看不清的终极解决方案](https://dpit.lib00.com/zh/content/1192/antigravity-perfect-dark-theme-modification-guide-fix-invisible-table-text)

---

## 🙏 致谢

- [@mikessslxxx](https://github.com/mikessslxxx) - v1.1.0 数学公式渲染、v2.0.1 性能优化

---

## 📄 开源协议

MIT License

---

## 🤝 贡献

欢迎通过 Issue 或 Pull Request 分享补丁、样式优化、功能改进和使用技巧。
