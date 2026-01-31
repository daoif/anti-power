<p align="center">
  <img src="docs/assets/images/LOGO.png" alt="Anti-Power" width="120">
</p>

<h1 align="center">Anti-Power Patch</h1>

<p align="center">
  <a href="https://github.com/daoif/anti-power/releases">
    <img src="https://img.shields.io/badge/Version-v2.3.3-blue.svg" alt="Version">
  </a>
  <a href="https://codeium.com/antigravity">
    <img src="https://img.shields.io/badge/Supports_Antigravity-v1.15.8-green.svg" alt="Antigravity">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-orange.svg" alt="License">
  </a>
</p>

<p align="center">
  <a href="README.md">中文</a> | English
</p>

> A patch for the Sidebar and Manager in **Antigravity AI IDE**.

<p align="center">
  💬 <a href="https://qm.qq.com/q/AHUKoyLVKg">QQ Group: 993975349</a>
</p>

---

## Features

| Feature | Description |
|---------|-------------|
| **Mermaid Rendering** | Auto-renders flowcharts, sequence diagrams, class diagrams, and more, with dark-theme support |
| **Math Rendering** | Renders inline `$...$` and block `$$...$$` formulas |
| **One-Click Copy** | Use Copy in the Sidebar or Manager to copy replies as Markdown |
| **Table Color Fix** | Makes table text visible in dark themes |
| **Manager Layout** | Adjust conversation width and font size |
| **Floating Copy Buttons** | Top right on hover, bottom right always visible |

### Copy Features

- Code blocks automatically include language identifiers, e.g., ` ```python `
- Tables convert to Markdown automatically
- Copies the final reply and skips intermediate reasoning
- Restores LaTeX and Mermaid source

---

## 📸 Demo

View the [screenshots](docs/reference/screenshots.md).

---

## 📥 Installation

### Windows (Recommended)

1. Go to the Releases page and download `anti-power.exe`.
2. Double-click to run without installing.
3. The patcher detects the Antigravity installation directory.
4. Select the desired features and click "Install Patch".
5. Restart Antigravity or reopen the Manager window to load the patch.

For manual installation, download the patch zip file from Releases (e.g., `anti-power-patches.zip`) and refer to [manual-install.md](patcher/patches/manual-install.md).

### macOS & Linux

Run [anti-power.sh](patcher/patches/anti-power.sh) to install the patch.

> ⚠️ On macOS, use the built-in **Terminal** if possible to avoid permission issues.

```bash
chmod +x ./anti-power.sh
sudo ./anti-power.sh
```

For manual installation, please refer to [manual-install.md](patcher/patches/manual-install.md).

---

## Notes

- **Updates**: Reinstall the patch if an Antigravity update overwrites it.
- **Compatibility**: Check your Antigravity version against the supported version before use.
- **Backups**: Back up the original files before replacing them so you can restore them.
- **Known Issues**: See [known-issues.md](docs/reference/known-issues.md).

---

## Documentation

- Project Structure & Classification: [project-structure.md](docs/reference/project-structure.md)
- Screenshots: [screenshots.md](docs/reference/screenshots.md)
- Known Issues: [known-issues.md](docs/reference/known-issues.md)
- Developer Guide: [developer-guide_EN.md](docs/guides/developer-guide_EN.md) | [中文](docs/guides/developer-guide.md)
- Release Guide: [release-guide.md](docs/guides/release-guide.md)
- Index: [README.md](docs/README.md)

---

## 📋 Version Info

Current Version: **v2.3.3** | Supports Antigravity: **v1.15.8**

For full changelog, see [CHANGELOG_EN.md](CHANGELOG_EN.md).

---

## Table Color Fix References

- 📺 **Video Tutorial**: [Antigravity Perfect Dark Theme Modification Guide](https://www.bilibili.com/video/BV1vTrgBXEA1)
- 📖 **Article**: [The Ultimate Solution for Invisible Table Text](https://dpit.lib00.com/zh/content/1192/antigravity-perfect-dark-theme-modification-guide-fix-invisible-table-text)

---

## 🤝 Contribution

Issues and Pull Requests are welcome.

---

## 🙏 Acknowledgments

- [@mikessslxxx](https://github.com/mikessslxxx) - Math formula rendering, Manager enhancements
- [@syanle](https://github.com/syanle) - Linux support
- [@Sophomoresty](https://github.com/Sophomoresty) - Copy function optimization, developer documentation

---

## ⚖️ License

MIT License
