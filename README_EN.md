<p align="center">
  <img src="docs/assets/images/LOGO.png" alt="Anti-Power" width="120">
</p>

<h1 align="center">Anti-Power Patch</h1>

<p align="center">
  <a href="https://github.com/daoif/anti-power/releases">
    <img src="https://img.shields.io/badge/Version-v2.3.0-blue.svg" alt="Version">
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

> 🚀 Enhancement patch for **Antigravity AI IDE**, improving the Sidebar and Manager window conversation experience!

<p align="center">
  💬 <a href="https://qm.qq.com/q/AHUKoyLVKg">QQ Group: 993975349</a>
</p>

---

## Introduction

Anti-Power enhances the Antigravity Sidebar and Manager window by applying patches that provide features such as Mermaid rendering, Math formula rendering, one-click copy, table color fixes, and font size/width adjustments. We hope to continuously improve the experience through community collaboration. Issues and Pull Requests are welcome.

---

## Features

| Feature | Description |
|---------|-------------|
| **Mermaid Rendering** | Automatically renders flowcharts, sequence diagrams, class diagrams, etc., supporting dark themes |
| **Math Formula Rendering** | Supports `$...$` inline formulas and `$$...$$` block formulas |
| **One-Click Copy** | Sidebar and Manager provide a Copy button that automatically converts to Markdown |
| **Table Color Fix** | Fixes invisible table text issues in dark themes |
| **Manager Layout Adjustment** | Supports conversation width and font size adjustment |
| **Floating Copy Button** | Floating button in the top right corner of content areas, unobtrusive to reading |

### Copy Feature Highlights

- Code blocks automatically include language identifiers, e.g., ` ```python `
- Tables are automatically converted to Markdown table format
- Smartly ignores AI intermediate thinking processes, copying only the final result
- Formulas and Mermaid diagrams are automatically restored to source code

---

## 📸 Demo

For screenshots, see [screenshots.md](docs/reference/screenshots.md).

---

## 📥 Installation

### Windows (Recommended)

1. Go to the Releases page and download `anti-power.exe`.
2. Double-click to run; no installation required.
3. The program automatically detects the Antigravity installation path.
4. Select the desired features and click "Install Patch".
5. Restart Antigravity or reopen the Manager window to see the effects.

For manual installation, download the patch zip file from Releases (e.g., `anti-power-patches.zip`) and refer to [manual-install.md](patcher/patches/manual-install.md).

### macOS & Linux

Now supports one-click replacement using the [anti-power.sh](patcher/patches/anti-power.sh) script.

> ⚠️ **Note**: Due to permissions, it is recommended to run the script directly using the macOS built-in **Terminal**.

```bash
chmod +x ./anti-power.sh
sudo ./anti-power.sh
```

For manual installation, please refer to [manual-install.md](patcher/patches/manual-install.md).

---

## Notes

- **Update Overwrite**: Official Antigravity updates may overwrite the patch, requiring reinstallation.
- **Version Compatibility**: Please verify that your Antigravity version matches the supported version before use.
- **Backup Habits**: Create a backup of original files before replacement to facilitate rollback.
- **Known Issues**: See [known-issues.md](docs/reference/known-issues.md).

---

## Documentation

- Project Structure & Classification: [project-structure.md](docs/reference/project-structure.md)
- Screenshots: [screenshots.md](docs/reference/screenshots.md)
- Known Issues: [known-issues.md](docs/reference/known-issues.md)
- Developer Guide: [developer-guide.md](docs/guides/developer-guide.md)
- Release Guide: [release-guide.md](docs/guides/release-guide.md)
- Index: [README.md](docs/README.md)

---

## 📋 Version Info

| Patch Version | Supported Antigravity Version | Date | Update Content |
|---------------|-------------------------------|------|----------------|
| v2.3.0 | v1.15.8 | 2026-01-30 | Copy enhancement: Markdown format preservation (headings/lists/bold/italic/links etc.) |
| v2.2.0 | v1.14.2 | 2026-01-21 | Manager Mermaid/Math rendering, width/font size adjustment, thanks to @mikessslxxx |
| v2.1.0 | v1.14.2 | 2026-01-19 | Sidebar font adjustment, Mermaid error hint optimization, Manager one-click copy |
| v2.0.1 | v1.14.2 | 2026-01-14 | Performance optimization |
| v2.0.0 | v1.14.2 | 2026-01-14 | Added Tauri tool, supports toggling individual features |
| v1.2.1 | v1.13.3 | 2026-01-13 | Bug fixes |
| v1.2.0 | v1.13.3 | 2026-01-13 | Mermaid rendering |
| v1.1.0 | v1.13.3 | 2026-01-13 | Math formula rendering |
| v1.0.0 | v1.13.3 | 2026-01-13 | One-click copy, table fix |

---

## 📚 References

The table color fix solution in this project references the following tutorials:

- 📺 **Video Tutorial**: [Antigravity Perfect Dark Theme Modification Guide](https://www.bilibili.com/video/BV1vTrgBXEA1)
- 📖 **Article**: [The Ultimate Solution for Invisible Table Text](https://dpit.lib00.com/zh/content/1192/antigravity-perfect-dark-theme-modification-guide-fix-invisible-table-text)

---

## 🤝 Contribution

Issues and Pull Requests are welcome.

---

## 🙏 Acknowledgments

Thanks to the following contributors for their support:

- [@mikessslxxx](https://github.com/mikessslxxx)

---

## ⚖️ License

MIT License

---

<p align="center">
  💡 If this project helps you, please Star ⭐
</p>
