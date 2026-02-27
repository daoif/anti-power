# Anti-Power Patch Manual Installation Guide

English | [中文](manual-install.md)

Manual installation and configuration instructions for Windows, macOS, and Linux.

## When to Use This Guide

If you downloaded the installer/app for your platform, it is recommended to use that first:

- Windows: `anti-power-windows.exe`
- macOS: `anti-power-macos-universal.dmg` -> `Anti-Power.app`
- Linux: `anti-power-linux.AppImage`

This document is mainly for the patch zip package (`anti-power-patches.zip`):

- Windows: use installer or manually replace files as described below
- macOS/Linux: script installation via `anti-power.sh` is recommended; manual install is for users familiar with paths and permissions

## Patch Package Contents

- anti-power.sh (macOS/Linux install script)
- anti-power.en.sh (macOS/Linux script with English output)
- cascade-panel.html
- cascade-panel/ directory
- workbench.html
- sidebar-panel/ directory
- workbench-jetski-agent.html
- manager-panel/ directory
- manual-install.md (Chinese)
- manual-install_EN.md (English, this document)

## Windows (Recommended: Installer)

1. Download `anti-power-windows.exe`
2. Double-click to run and auto-detect Antigravity install path
3. Select features and click Install Patch
4. Reopen Antigravity and the Manager window

## Windows (Manual Installation)

1. Close all Antigravity windows
2. Go to install paths:
   - `...\resources\app\extensions\antigravity\`
   - `...\resources\app\out\vs\code\electron-browser\workbench\`
3. Choose sidebar entry by `ideVersion` in `product.json`:
   - If `< 1.18.3`:
     - Backup `cascade-panel.html` -> `cascade-panel.html.bak`
     - Copy `cascade-panel.html` and `cascade-panel/` into `extensions\antigravity\`
   - If `>= 1.18.3`:
     - Backup `workbench.html` -> `workbench.html.bak`
     - Copy `workbench.html` and `sidebar-panel/` into `workbench\`
4. Backup and replace Manager files:
   - Backup `workbench-jetski-agent.html` -> `workbench-jetski-agent.html.bak`
   - Copy `workbench-jetski-agent.html` and `manager-panel/` into `workbench\`
5. Reopen Antigravity and the Manager window

## macOS (Patch Package Recommended: Script)

1. Unzip patch package and open Terminal in that directory
2. Make script executable:
   ```bash
   chmod +x ./anti-power.sh
   ```
3. Run script (requires sudo):
   ```bash
   sudo ./anti-power.sh
   ```
4. Script will choose sidebar entry automatically by `product.json.ideVersion`:
   - `< 1.18.3`: use legacy `cascade-panel` entry
   - `>= 1.18.3`: use modern `workbench.html + sidebar-panel` entry
5. Reopen Antigravity and the Manager window

## Linux (Patch Package Recommended: Script)

1. Unzip patch package and open Terminal in that directory
2. Make script executable:
   ```bash
   chmod +x ./anti-power.sh
   ```
3. Run script (requires sudo):
   ```bash
   sudo ./anti-power.sh
   ```
4. Script will choose sidebar entry automatically by `product.json.ideVersion`:
   - `< 1.18.3`: use legacy `cascade-panel` entry
   - `>= 1.18.3`: use modern `workbench.html + sidebar-panel` entry
5. Reopen Antigravity and the Manager window

## macOS (Manual Installation)

1. Close all Antigravity windows
2. In Applications, right-click Antigravity and choose Show Package Contents
3. Go to:
   - `Antigravity.app/Contents/Resources/app/extensions/antigravity/`
   - `Antigravity.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/`
4. Choose sidebar entry by `ideVersion` in `product.json`:
   - If `< 1.18.3`:
     - Backup `cascade-panel.html` -> `cascade-panel.html.bak`
     - Copy `cascade-panel.html` and `cascade-panel/` into `extensions/antigravity/`
   - If `>= 1.18.3`:
     - Backup `workbench.html` -> `workbench.html.bak`
     - Copy `workbench.html` and `sidebar-panel/` into `workbench/`
5. Backup and replace Manager files:
   - Backup `workbench-jetski-agent.html` -> `workbench-jetski-agent.html.bak`
   - Copy `workbench-jetski-agent.html` and `manager-panel/` into `workbench/`
6. Reopen Antigravity and the Manager window

## Configuration

Patch config files are generated at the following paths:

- Sidebar (legacy): `extensions/antigravity/cascade-panel/config.json`
- Sidebar (modern): `out/vs/code/electron-browser/workbench/sidebar-panel/config.json`
- Manager: `out/vs/code/electron-browser/workbench/manager-panel/config.json`

Example (Sidebar):

```json
{
  "mermaid": true,
  "math": true,
  "copyButton": true,
  "tableColor": true,
  "fontSizeEnabled": true,
  "fontSize": 20
}
```

Example (Manager):

```json
{
  "mermaid": true,
  "math": true,
  "copyButton": true,
  "maxWidthEnabled": true,
  "maxWidthRatio": 75,
  "fontSizeEnabled": true,
  "fontSize": 16
}
```

After config changes, reopen Manager window to apply.

## Notes

- ~~Modifying `workbench-jetski-agent.html` used to trigger "installation appears corrupted"~~ (fixed since v2.3.2+)
- Official Antigravity updates may overwrite patch files; reinstall if needed
