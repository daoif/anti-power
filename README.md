# Antigravity Power 增强补丁

[![版本](https://img.shields.io/badge/版本-v1.2.1-blue.svg)](https://github.com/daoif/anti-power/releases)
[![Antigravity](https://img.shields.io/badge/支持_Antigravity-v1.13.3-green.svg)](https://codeium.com/antigravity)
[![开源协议](https://img.shields.io/badge/协议-MIT-orange.svg)](LICENSE)

> 🚀 针对 **Antigravity AI IDE** 的增强补丁，让你的 AI 对话体验更上一层楼！

---

## 🎯 项目愿景

建立这个仓库的初衷是希望**大家一起来共同提升 Antigravity 的使用体验**。

Antigravity 是一款优秀的 AI IDE，但在日常使用中难免会遇到一些小问题或不便之处。我们希望通过社区的力量，收集和分享各种增强补丁、优化技巧，让每一位用户都能获得更好的使用体验。

**欢迎提交你的增强方案！** 无论是样式优化、功能增强还是使用技巧，都可以通过 Issue 或 Pull Request 分享给大家。

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

### 方式一：GitHub Releases（推荐）

前往 [Releases 页面](https://github.com/daoif/anti-power/releases) 下载最新版本。

### 方式二：直接下载文件

下载本仓库的 `cascade-panel.html` 文件。

---

## 🔧 安装步骤

### 步骤一：找到 Antigravity 安装目录

#### 📁 Windows

1. 在桌面上右键点击 **Antigravity** 快捷方式
2. 选择 **"属性 (Properties)"**
3. 点击 **"打开文件所在位置 (Open File Location)"**
4. 进入目录：`resources\app\extensions\antigravity\`

**完整路径示例：**
```
C:\Program Files\Antigravity\resources\app\extensions\antigravity\
```

<details>
<summary><b>📁 macOS</b></summary>

1. 打开 **"应用程序 (Applications)"** 文件夹
2. 右键点击 **Antigravity.app**
3. 选择 **"显示包内容 (Show Package Contents)"**
4. 进入目录：`Contents/Resources/app/extensions/antigravity/`

**完整路径：**
```
/Applications/Antigravity.app/Contents/Resources/app/extensions/antigravity/
```

</details>

### 步骤二：备份原文件（重要！）

将原始的 `cascade-panel.html` 重命名为 `cascade-panel.html.bak` 或复制到其他位置保存。

### 步骤三：替换文件

将下载的 `cascade-panel.html` 复制到上述目录中，覆盖原文件。

### 步骤四：重启 Antigravity

**完全关闭** Antigravity 后重新启动，即可看到增强效果。

---

## 📋 版本信息

| 补丁版本 | 支持的 Antigravity 版本 | 发布日期 | 更新内容 |
|---------|------------------------|----------|----------|
| v1.2.1  | v1.13.3                | 2026-01-13 | Bug 修复 |
| v1.2.0  | v1.13.3                | 2026-01-13 | Mermaid 渲染 |
| v1.1.0  | v1.13.3                | 2026-01-13 | 数学公式渲染 |
| v1.0.0  | v1.13.3                | 2026-01-13 | 一键复制、表格修复 |

---

## ⚠️ 注意事项

- **更新覆盖**：Antigravity 官方更新后，此修改可能会被覆盖，需要重新应用补丁
- **版本兼容**：建议在使用前确认 Antigravity 版本号与支持版本一致
- **备份习惯**：每次替换前请务必备份原文件，以便需要时恢复

---

## 📚 参考资料

本项目的表格颜色修复方案参考了以下教程：

- 📺 **视频教程**：[Antigravity 完美深色主题修改指南](https://www.bilibili.com/video/BV1vTrgBXEA1)
- 📖 **图文教程**：[表格文字看不清的终极解决方案](https://dpit.lib00.com/zh/content/1192/antigravity-perfect-dark-theme-modification-guide-fix-invisible-table-text)

---

## 🙏 致谢

感谢以下贡献者对本项目的支持：

- [@mikessslxxx](https://github.com/mikessslxxx) - v1.1.0 数学公式渲染、代码重构与优化

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
