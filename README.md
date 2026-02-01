<p align="center">
  <img src="docs/assets/images/LOGO.png" alt="Anti-Power" width="120">
</p>

<h1 align="center">Anti-Power 增强补丁</h1>

<p align="center">
  <a href="https://github.com/daoif/anti-power/releases">
    <img src="https://img.shields.io/badge/版本-v2.3.4-blue.svg" alt="版本">
  </a>
  <a href="https://codeium.com/antigravity">
    <img src="https://img.shields.io/badge/支持_Antigravity-v1.15.8-green.svg" alt="Antigravity">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/协议-MIT-orange.svg" alt="开源协议">
  </a>
</p>

<p align="center">
  中文 | <a href="README_EN.md">English</a>
</p>

> **Antigravity AI IDE** 侧边栏和 Manager 窗口补丁。

<p align="center">
  💬 <a href="https://qm.qq.com/q/AHUKoyLVKg">QQ 交流群: 993975349</a>
</p>

---

## 功能特性

| 功能 | 描述 |
|------|------|
| **Mermaid 渲染** | 自动渲染流程图, 时序图, 类图等, 支持深色主题 |
| **数学公式渲染** | 支持 `$...$` 行内公式和 `$$...$$` 块级公式 |
| **一键复制** | 用侧边栏或 Manager 的 Copy 按钮将回复复制为 Markdown |
| **表格颜色修复** | 修复深色主题下表格文字不可见问题 |
| **Manager 布局调节** | 支持对话宽度与字号调节 |
| **悬浮复制按钮** | 右上角悬停时显示，右下角始终显示 |

### 复制功能

- 代码块自动带语言标识, 例如 ` ```python `
- 自动将表格转为 Markdown
- 跳过中间思考过程，只复制最终回复
- 公式和 Mermaid 图表还原为源码

---

## 📸 效果展示

查看[效果截图](docs/reference/screenshots.md)。

---

## 📥 下载安装

### Windows（推荐）

1. 前往 Releases 页面下载 `anti-power.exe`
2. 双击运行, 无需安装
3. 安装器自动检测 Antigravity 安装路径
4. 选择需要的功能, 点击 "安装补丁"
5. 重启 Antigravity 或重新打开 Manager 窗口以加载补丁

如需手动安装, 下载 Release 中的补丁压缩包 (例如 `anti-power-patches.zip`), 并参考 [manual-install.md](patcher/patches/manual-install.md).

### macOS & Linux

运行 [anti-power.sh](patcher/patches/anti-power.sh) 安装补丁.

> ⚠️ 受权限限制, 建议在 macOS 自带的 **Terminal (终端)** 中运行脚本.

```bash
chmod +x ./anti-power.sh
sudo ./anti-power.sh
```

如需手动安装，请参考 [manual-install.md](patcher/patches/manual-install.md).

---

## 注意事项

- **更新覆盖**: Antigravity 更新可能覆盖补丁. 若被覆盖, 请重新安装.
- **版本兼容**: 使用前请核对当前 Antigravity 版本是否与支持版本一致.
- **备份文件**: 替换前先备份原文件, 以便恢复.
- **已知问题**: 详见 [known-issues.md](docs/reference/known-issues.md)

---

## 文档导航

- 项目结构与分类说明: [project-structure.md](docs/reference/project-structure.md)
- 效果截图: [screenshots.md](docs/reference/screenshots.md)
- 已知问题: [known-issues.md](docs/reference/known-issues.md)
- 开发者文档: [developer-guide.md](docs/guides/developer-guide.md) | [English](docs/guides/developer-guide_EN.md)
- 发布指南: [release-guide.md](docs/guides/release-guide.md)
- 文档索引: [README.md](docs/README.md)

---

## 📋 版本信息

当前版本: **v2.3.4** | 支持 Antigravity: **v1.15.8**

完整更新日志请查看 [CHANGELOG.md](CHANGELOG.md).

---

## 表格颜色修复参考

- 📺 **视频教程**: [Antigravity 完美深色主题修改指南](https://www.bilibili.com/video/BV1vTrgBXEA1)
- 📖 **图文教程**: [表格文字看不清的终极解决方案](https://dpit.lib00.com/zh/content/1192/antigravity-perfect-dark-theme-modification-guide-fix-invisible-table-text)

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request.

---

## 🙏 致谢

- [@mikessslxxx](https://github.com/mikessslxxx) - 数学公式渲染、Manager 功能增强
- [@syanle](https://github.com/syanle) - Linux 支持
- [@Sophomoresty](https://github.com/Sophomoresty) - 复制功能优化、开发者文档

---

## ⚖️ 开源协议

MIT License
