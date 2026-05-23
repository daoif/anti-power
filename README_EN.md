<p align="center">
  <img src="docs/assets/images/LOGO.png" alt="Anti-Power" width="120">
</p>

<h1 align="center">Anti-Power</h1>

<p align="center">
  <a href="https://github.com/daoif/anti-power/releases"><img src="https://img.shields.io/badge/Version-v4.0.0-blue.svg" alt="Version"></a>
  <a href="https://antigravity.google/docs/ide-getting-started"><img src="https://img.shields.io/badge/Supports_Antigravity_IDE-v2.0.6-green.svg" alt="Antigravity IDE"></a>
</p>

<p align="center">
  <a href="README.md">中文</a> | English
</p>

> Copy replies as Markdown, render LaTeX and Mermaid, and fix dark-theme tables in the **Antigravity IDE** Sidebar and Manager.

<p align="center">
  <a href="https://qm.qq.com/q/AHUKoyLVKg">QQ Group: 993975349</a>
</p>

## Features

| Feature | Description |
|---------|-------------|
| **Mermaid Rendering** | Auto-renders flowcharts, sequence diagrams, class diagrams, and more, with dark-theme support |
| **Math Rendering** | Renders inline `$...$` and block `$$...$$` formulas |
| **One-Click Copy** | Use Copy in the Sidebar or Manager to copy replies as Markdown |
| **Table Color Fix** | Makes table text visible in dark themes |
| **Manager Layout** | Adjust conversation width and font size. Code blocks follow the font size setting |
| **Floating Copy Buttons** | Top right on hover, bottom right always visible |

### Copying replies

- Code blocks automatically include language identifiers, e.g., \`\`\`python
- Tables convert to Markdown automatically
- Copies the final reply and skips intermediate reasoning
- Restores LaTeX and Mermaid source

### Installer

- Switch between English and Chinese
- Switch between light and dark themes
- Detects the IDE installation directory automatically
- Use the **Session Viewer** to view and batch-delete local conversations from Claude Code, Codex, Gemini CLI, OpenCode, and OpenClaw
- Clear conversation caches for Antigravity, Gemini CLI, Codex, Claude Code, OpenCode, and OpenClaw on Windows, macOS, and Linux

## Screenshots

View the [screenshots](docs/reference/screenshots.md).

## Installation

### Windows

1. Go to the Releases page and download `anti-power-windows.exe`.
2. Double-click to run without installing.
3. The patcher detects the Antigravity installation directory.
4. Select the desired features and click "Install Patch".
5. Restart Antigravity or reopen the Manager window to load the patch.

For manual installation, download the patch zip file from Releases (e.g., `anti-power-patches.zip`) and refer to [manual-install_EN.md](patcher/patches/manual-install_EN.md).

### macOS

1. Download `anti-power-macos-universal.dmg` (Intel/Apple Silicon)
2. Open the DMG and drag `Anti-Power.app` to Applications
3. Run it and install the patch as prompted

#### If macOS says the app is damaged

If macOS shows "is damaged" or "can't be opened" on first launch, try the following workaround.

```bash
# Remove the quarantine attribute (adjust the path if needed)
xattr -cr /Applications/Anti-Power.app
```

You can also right-click the app and choose "Open".

### Linux

1. Download `anti-power-linux.AppImage`
2. Make it executable and run it, then install the patch as prompted

```bash
chmod +x ./anti-power-linux.AppImage
./anti-power-linux.AppImage
```

### macOS and Linux script

If the installer is unavailable or you need a command-line or batch install, download and extract `anti-power-patches.zip` from Releases. Run `anti-power.sh` in the extracted folder.

> Run the script in a terminal with **administrator privileges**.

```bash
# Run inside the extracted patches folder
chmod +x ./anti-power.sh
sudo ./anti-power.sh
```

For manual installation, please refer to [manual-install_EN.md](patcher/patches/manual-install_EN.md).

## Usage notes

- **Updates**: Reinstall the patch if an Antigravity update overwrites it.
- **Compatibility**: Check your Antigravity version against the supported version before use.
- **Backups**: Back up the original files before replacing them so you can restore them.

## Documentation

- [Documentation index and project structure](docs/README.md)
- Known Issues: [known-issues.md](docs/reference/known-issues.md)
- Developer Guide: [developer-guide_EN.md](docs/guides/developer-guide_EN.md) | [中文](docs/guides/developer-guide.md)
- Release Guide: [release-guide.md](docs/guides/release-guide.md)

## Version and compatibility

Current Version: **v4.0.0** | Supports Antigravity IDE: **v2.0.6**

For full changelog, see [CHANGELOG_EN.md](CHANGELOG_EN.md).

## Table color fix references

- **Video Tutorial**: [Antigravity Perfect Dark Theme Modification Guide](https://www.bilibili.com/video/BV1vTrgBXEA1)
- **Article**: [The Ultimate Solution for Invisible Table Text](https://dpit.lib00.com/zh/content/1192/antigravity-perfect-dark-theme-modification-guide-fix-invisible-table-text)

## Contributing

Issues and Pull Requests are welcome.

## Acknowledgments

- [@mikessslxxx](https://github.com/mikessslxxx) - Math formula rendering, Manager enhancements
- [@syanle](https://github.com/syanle) - Linux support
- [@Sophomoresty](https://github.com/Sophomoresty) - Copy function optimization, developer documentation
- [@Wusir7355608](https://github.com/Wusir7355608)
- [@aiaiads](https://github.com/aiaiads)

## License

MIT License
