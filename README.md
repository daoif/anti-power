# Antigravity Power 增强补丁

[![版本](https://img.shields.io/badge/版本-v1.0.0-blue.svg)](https://github.com/daoif/anti-power/releases)
[![Antigravity](https://img.shields.io/badge/支持_Antigravity-v1.13.3-green.svg)](https://codeium.com/antigravity)

> **Antigravity AI IDE** 侧边栏补丁。

## ✨ 功能特性

### 1. 表格颜色修复
修复深色主题下 AI 回复的表格文字颜色。

### 2. 一键复制按钮
**Copy** 按钮跳过中间思考过程，将最终回复复制为 Markdown。

- 📝 代码块自动转换为 Markdown 格式（带语言标识）
- 📊 自动将表格转为 Markdown

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

将原始 `cascade-panel.html` 重命名为 `cascade-panel.html.bak`，或复制到其他位置备份。

### 步骤三：替换文件

将下载的 `cascade-panel.html` 复制到上述目录，替换原文件。

### 步骤四：重启 Antigravity

**完全退出** Antigravity，再重新启动。

## 📋 版本信息

| 补丁版本 | 支持的 Antigravity 版本 | 发布日期 |
|---------|------------------------|----------|
| v1.0.0  | v1.13.3                | 2026-01-13 |

## ⚠️ 注意事项

- **更新覆盖**：Antigravity 更新可能覆盖补丁。若被覆盖，请重新安装。
- **版本兼容**：建议使用前核对当前 Antigravity 版本是否与支持版本一致。
- **备份文件**：每次替换前先备份原文件，以便恢复。

## 表格颜色修复参考

- 📺 **视频教程**：[Antigravity 完美深色主题修改指南](https://www.bilibili.com/video/BV1vTrgBXEA1)
- 📖 **图文教程**：[表格文字看不清的终极解决方案](https://dpit.lib00.com/zh/content/1192/antigravity-perfect-dark-theme-modification-guide-fix-invisible-table-text)

## 📄 开源协议

MIT License

## 🤝 贡献

欢迎通过 Issue 或 Pull Request 分享补丁、样式优化、功能改进和使用技巧。
