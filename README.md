<p align="center">
  <img src="docs/assets/images/LOGO.png" alt="Anti-Power" width="120">
</p>

<h1 align="center">Anti-Power 增强补丁</h1>

<p align="center">
  <a href="https://github.com/daoif/anti-power/releases">
    <img src="https://img.shields.io/badge/版本-v2.3.2-blue.svg" alt="版本">
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

> 🚀 针对 **Antigravity AI IDE** 的增强补丁, 提升侧边栏和 Manager 窗口的对话体验!

<p align="center">
  💬 <a href="https://qm.qq.com/q/AHUKoyLVKg">QQ 交流群: 993975349</a>
</p>

---

## 项目简介

Anti-Power 以补丁方式增强 Antigravity 的侧边栏和 Manager 窗口, 提供 Mermaid 渲染, 数学公式渲染, 一键复制, 表格颜色修复, 字号与宽度调节等能力. 我们希望通过社区协作持续完善体验, 欢迎提交 Issue 或 Pull Request.

---

## 功能特性

| 功能 | 描述 |
|------|------|
| **Mermaid 渲染** | 自动渲染流程图, 时序图, 类图等, 支持深色主题 |
| **数学公式渲染** | 支持 `$...$` 行内公式和 `$$...$$` 块级公式 |
| **一键复制** | 侧边栏与 Manager 提供 Copy 按钮, 自动转 Markdown |
| **表格颜色修复** | 修复深色主题下表格文字不可见问题 |
| **Manager 布局调节** | 支持对话宽度与字号调节 |
| **悬浮复制按钮** | 右上角悬停按钮 + 右下角常驻按钮, 方便随时复制 |

### 复制功能亮点

- 代码块自动带语言标识, 例如 ` ```python `
- 表格自动转换为 Markdown 表格格式
- 智能忽略 AI 中间思考过程, 仅复制最终结果
- 公式和 Mermaid 自动还原为源码

---

## 📸 效果展示

效果截图见 [screenshots.md](docs/reference/screenshots.md).

---

## 📥 下载安装

### Windows（推荐）

1. 前往 Releases 页面下载 `anti-power.exe`
2. 双击运行, 无需安装
3. 程序自动检测 Antigravity 安装路径
4. 选择需要的功能, 点击 安装补丁
5. 重启 Antigravity 或重新打开 Manager 窗口查看效果

如需手动安装, 下载 Release 中的补丁压缩包 (例如 `anti-power-patches.zip`), 并参考 [manual-install.md](patcher/patches/manual-install.md).

### macOS & Linux

现支持使用 [anti-power.sh](patcher/patches/anti-power.sh) 脚本一键替换

> ⚠️ **注意**: 由于权限原因, 建议直接使用 macOS 自带的 **Terminal (终端)** 运行脚本

```bash
chmod +x ./anti-power.sh
sudo ./anti-power.sh
```

如需手动安装，请参考 [manual-install.md](patcher/patches/manual-install.md).

---

## 注意事项

- **更新覆盖**: Antigravity 官方更新后, 补丁可能被覆盖, 需要重新安装
- **版本兼容**: 使用前请确认 Antigravity 版本与支持版本一致
- **备份习惯**: 替换文件前请备份原文件, 便于回滚
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

当前版本: **v2.3.2** | 支持 Antigravity: **v1.15.8**

完整更新日志请查看 [CHANGELOG.md](CHANGELOG.md).

---

## 📚 参考资料

本项目的表格颜色修复方案参考了以下教程:

- 📺 **视频教程**: [Antigravity 完美深色主题修改指南](https://www.bilibili.com/video/BV1vTrgBXEA1)
- 📖 **图文教程**: [表格文字看不清的终极解决方案](https://dpit.lib00.com/zh/content/1192/antigravity-perfect-dark-theme-modification-guide-fix-invisible-table-text)

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request.

---

## 🙏 致谢

感谢以下贡献者对本项目的支持:

- [@mikessslxxx](https://github.com/mikessslxxx) - 数学公式渲染、Manager 功能增强
- [@syanle](https://github.com/syanle) - Linux 支持
- [@Sophomoresty](https://github.com/Sophomoresty) - 复制功能优化、开发者文档

---

## ⚖️ 开源协议

MIT License

---

<p align="center">
  💡 如果这个项目对你有帮助, 欢迎 Star ⭐
</p>
