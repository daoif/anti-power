<p align="center">
  <img src="docs/assets/images/LOGO.png" alt="Anti-Power" width="120">
</p>

<h1 align="center">Anti-Power Patch</h1>

<p align="center">
  <a href="https://github.com/daoif/anti-power/releases">
    <img src="https://img.shields.io/badge/Version-v2.2.0-blue.svg" alt="Version">
  </a>
  <a href="https://codeium.com/antigravity">
    <img src="https://img.shields.io/badge/Supports_Antigravity-v1.14.2-green.svg" alt="Antigravity">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-orange.svg" alt="License">
  </a>
  <br>
  <a href="README.md">
    <img src="https://img.shields.io/badge/Language-简体中文-blue?style=for-the-badge&logo=google-translate&logoColor=white" alt="简体中文">
  </a>
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
| **Floating Copy Button** | Appears on hover at the top right of the content area |

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

### macOS

macOS now supports one-click replacement using the [anti-power-macOS.sh](patcher/patches/anti-power-macOS.sh) script.

> ⚠️ On macOS, use the built-in **Terminal** if possible to avoid permission issues.

```bash
chmod +x ./anti-power-macOS.sh
sudo ./anti-power-macOS.sh
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
- Developer Guide: [developer-guide.md](docs/guides/developer-guide.md)
- Release Guide: [release-guide.md](docs/guides/release-guide.md)
- Index: [README.md](docs/README.md)

---

## 📋 Version Info

| Patch Version | Supported Antigravity Version | Date | Update Content |
|---------------|-------------------------------|------|----------------|
| v2.2.0 | v1.14.2 | 2026-01-21 | Manager Mermaid/Math rendering, width/font size adjustment, thanks to @mikessslxxx |
| v2.1.0 | v1.14.2 | 2026-01-19 | Sidebar font adjustment, Mermaid error hint optimization, Manager one-click copy |
| v2.0.1 | v1.14.2 | 2026-01-14 | Performance optimization |
| v2.0.0 | v1.14.2 | 2026-01-14 | Added Tauri tool, supports toggling individual features |
| v1.2.1 | v1.13.3 | 2026-01-13 | Bug fixes |
| v1.2.0 | v1.13.3 | 2026-01-13 | Mermaid rendering |
| v1.1.0 | v1.13.3 | 2026-01-13 | Math formula rendering |
| v1.0.0 | v1.13.3 | 2026-01-13 | One-click copy, table fix |

---

## Table Color Fix References

- 📺 **Video Tutorial**: [Antigravity Perfect Dark Theme Modification Guide](https://www.bilibili.com/video/BV1vTrgBXEA1)
- 📖 **Article**: [The Ultimate Solution for Invisible Table Text](https://dpit.lib00.com/zh/content/1192/antigravity-perfect-dark-theme-modification-guide-fix-invisible-table-text)

---

## 🤝 Contribution

Issues and Pull Requests are welcome.

---

## 🙏 Acknowledgments

- [@mikessslxxx](https://github.com/mikessslxxx)

---

## ⚖️ License

MIT License
