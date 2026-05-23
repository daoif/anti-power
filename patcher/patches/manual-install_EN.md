# Anti-Power Patch Manual Installation Guide

English | [中文](manual-install.md)

Manual installation and configuration instructions for Windows, macOS, and Linux.

## When to Use This Guide

Use your platform’s installer when available.

- Windows: `anti-power-windows.exe`
- macOS: `anti-power-macos-universal.dmg` -> `Anti-Power.app`
- Linux: `anti-power-linux.AppImage`

Use `anti-power-patches.zip` for manual installation.

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
2. Run the installer. It detects the Antigravity installation directory.
3. Select features and click Install Patch
4. Reopen Antigravity and the Manager window

## Windows (Manual Installation)

1. Close all Antigravity windows
2. Go to install paths (newer builds are commonly under `Antigravity IDE`, older builds under `Antigravity`):
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

1. Extract the patch package and open Terminal in that directory
2. Make the script executable.
   ```bash
   chmod +x ./anti-power.sh
   ```
3. Run the script with sudo.
   ```bash
   sudo ./anti-power.sh
   ```
4. Script will choose sidebar entry automatically by `product.json.ideVersion`:
   - `< 1.18.3`: use legacy `cascade-panel` entry
   - `>= 1.18.3`: use modern `workbench.html + sidebar-panel` entry
5. Reopen Antigravity and the Manager window

## Linux (Patch Package Recommended: Script)

1. Extract the patch package and open Terminal in that directory
2. Make the script executable.
   ```bash
   chmod +x ./anti-power.sh
   ```
3. Run the script with sudo.
   ```bash
   sudo ./anti-power.sh
   ```
4. Script will choose sidebar entry automatically by `product.json.ideVersion`:
   - `< 1.18.3`: use legacy `cascade-panel` entry
   - `>= 1.18.3`: use modern `workbench.html + sidebar-panel` entry
5. Reopen Antigravity and the Manager window

## macOS (Manual Installation)

1. Close all Antigravity windows
2. In Applications, right-click Antigravity IDE (or older Antigravity) and choose Show Package Contents
3. Go to:
   - `Antigravity IDE.app/Contents/Resources/app/extensions/antigravity/`
   - `Antigravity IDE.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/`
   - Older builds may still use `Antigravity.app/Contents/Resources/app/...`
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

The patch generates configuration files at the following paths.

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

Reopen the Manager window to apply configuration changes.

## Notes

- ~~Modifying `workbench-jetski-agent.html` used to trigger "installation appears corrupted"~~ (fixed since v2.3.2+)
- Reinstall the patch if an Antigravity update overwrites it.
