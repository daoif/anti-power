# Antigravity Power 增强补丁

[![版本](https://img.shields.io/badge/版本-v1.2.0-blue.svg)](https://github.com/daoif/anti-power/releases)
[![Antigravity](https://img.shields.io/badge/支持_Antigravity-v1.13.3-green.svg)](https://codeium.com/antigravity)

针对 **Antigravity AI IDE** 的增强补丁，提供 **一键复制** + **数学公式渲染** + **Mermaid 图表渲染** + **表格颜色修复** 等功能。

## 🎯 项目愿景

建立这个仓库的初衷是希望**大家一起来共同提升 Antigravity 的使用体验**。

Antigravity 是一款优秀的 AI IDE，但在日常使用中难免会遇到一些小问题或不便之处。我们希望通过社区的力量，收集和分享各种增强补丁、优化技巧，让每一位用户都能获得更好的使用体验。

**欢迎提交你的增强方案！** 无论是样式优化、功能增强还是使用技巧，都可以通过 Issue 或 Pull Request 分享给大家。

## ✨ 功能特性

### 1. 表格颜色修复
修复深色主题下 AI 返回的表格文字颜色与背景融为一体、无法阅读的问题。

### 2. 一键复制按钮
为 AI 的返回内容添加 **Copy** 按钮，支持：
- 📋 复制最终返回结果（自动忽略中间思考过程）
- 📝 代码块自动转换为 Markdown 格式（带语言标识）
- 📊 表格自动转换为 Markdown 表格格式

### 3. 数学公式渲染 🆕
自动渲染 AI 返回内容中的 LaTeX 数学公式：
- 📐 支持行内公式 `$...$` 和块级公式 `$$...$$`
- 🔢 自动加载 KaTeX 或 MathJax 引擎
- 📎 复制时自动还原为 LaTeX 源码

### 4. 内容区域悬浮复制 🆕
每个内容区域右上角新增悬浮复制按钮：
- 👆 鼠标悬停时显示，不影响阅读
- ⚡ 独立于反馈按钮，复制更便捷

### 5. Mermaid 流程图渲染 🆕
自动渲染 AI 返回的 Mermaid 图表：
- 📊 支持流程图、时序图、类图等多种图表类型
- 🎨 自动适配深色主题配色
- 📋 复制时自动还原为 Mermaid 源码

## 📥 下载安装

### 方式一：GitHub Releases（推荐）

前往 [Releases 页面](https://github.com/daoif/anti-power/releases) 下载最新版本。

### 方式二：直接下载文件

下载本仓库的 `cascade-panel.html` 文件。

## 🔧 安装步骤

### 步骤一：找到 Antigravity 安装目录

<details>
<summary><b>Windows</b></summary>

1. 在桌面上右键点击 **Antigravity** 快捷方式
2. 选择 **"属性 (Properties)"**
3. 点击 **"打开文件所在位置 (Open File Location)"**
4. 进入目录：`resources\app\extensions\antigravity\`

**完整路径示例：**
```
C:\Program Files\Antigravity\resources\app\extensions\antigravity\
```

</details>

<details>
<summary><b>macOS</b></summary>

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

## 📋 版本信息

| 补丁版本 | 支持的 Antigravity 版本 | 发布日期 |
|---------|------------------------|----------|
| v1.2.0  | v1.13.3                | 2026-01-13 |
| v1.1.0  | v1.13.3                | 2026-01-13 |
| v1.0.0  | v1.13.3                | 2026-01-13 |

## ⚠️ 注意事项

- **更新覆盖**：Antigravity 官方更新后，此修改可能会被覆盖，需要重新应用补丁
- **版本兼容**：建议在使用前确认 Antigravity 版本号与支持版本一致
- **备份习惯**：每次替换前请务必备份原文件，以便需要时恢复

## 📚 参考资料

本项目的表格颜色修复方案参考了以下教程：

- 📺 **视频教程**：[Antigravity 完美深色主题修改指南](https://www.bilibili.com/video/BV1vTrgBXEA1)
- 📖 **图文教程**：[表格文字看不清的终极解决方案](https://dpit.lib00.com/zh/content/1192/antigravity-perfect-dark-theme-modification-guide-fix-invisible-table-text)

## 📄 开源协议

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 🙏 致谢

感谢以下贡献者对本项目的支持：

- [@mikessslxxx](https://github.com/mikessslxxx) - v1.1.0 数学公式渲染、代码重构与优化

---

> 💡 如果这个项目对你有帮助，欢迎 Star ⭐
