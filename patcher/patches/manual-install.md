# Anti-Power 补丁手动安装说明

本指南介绍 Windows, macOS 和 Linux 上的手动安装与配置.

## 适用场景

优先使用对应平台的安装器。

- Windows: `anti-power-windows.exe`
- macOS: `anti-power-macos-*.dmg` -> `anti-power.app`
- Linux: `anti-power-linux.AppImage`

手动安装使用补丁包 `anti-power-patches.zip`。

- Windows: 可用安装器, 或按下文手动替换
- macOS/Linux: 推荐用 `anti-power.sh` (会自动备份与替换), 手动安装仅适合熟悉路径与权限的用户

## 补丁包内容

- anti-power.sh (macOS/Linux 安装脚本)
- cascade-panel.html
- cascade-panel/ 目录
- workbench-jetski-agent.html
- manager-panel/ 目录
- manual-install.md (本文档)

## Windows (推荐: 安装器方式)

1. 下载 `anti-power-windows.exe`
2. 双击启动安装器, 由它检测 Antigravity 安装路径
3. 勾选所需功能并点击 "安装补丁"
4. 重新打开 Antigravity 与 Manager 窗口

## Windows (手动安装)

1. 关闭所有 Antigravity 窗口
2. 进入安装目录:
   - ...\resources\app\extensions\antigravity\
   - ...\resources\app\out\vs\code\electron-browser\workbench\
3. 备份并替换文件:
   - 备份 cascade-panel.html -> cascade-panel.html.bak
   - 复制 cascade-panel.html 与 cascade-panel/ 到 extensions\antigravity\
   - 备份 workbench-jetski-agent.html -> workbench-jetski-agent.html.bak
   - 复制 workbench-jetski-agent.html 与 manager-panel/ 到 workbench\
4. 重新打开 Antigravity 与 Manager 窗口

## macOS (补丁包推荐: 脚本方式)

1. 解压补丁包, 在 Terminal (终端) 中进入解压目录
2. 赋予脚本执行权限:
   ```bash
   chmod +x ./anti-power.sh
   ```
3. 运行脚本 (需要 sudo 权限):
   ```bash
   sudo ./anti-power.sh
   ```
4. 脚本会自动备份原文件并完成替换
5. 重新打开 Antigravity 与 Manager 窗口

## Linux (补丁包推荐: 脚本方式)

1. 解压补丁包, 在 Terminal (终端) 中进入解压目录
2. 赋予脚本执行权限:
   ```bash
   chmod +x ./anti-power.sh
   ```
3. 运行脚本 (需要 sudo 权限):
   ```bash
   sudo ./anti-power.sh
   ```
4. 脚本会自动备份原文件并完成替换
5. 重新打开 Antigravity 与 Manager 窗口

## macOS (手动安装)

1. 关闭所有 Antigravity 窗口
2. 打开 Applications, 右键 Antigravity, 选择 显示包内容
3. 进入目录:
   - Antigravity.app/Contents/Resources/app/extensions/antigravity/
   - Antigravity.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/
4. 备份并替换文件:
   - 备份 cascade-panel.html -> cascade-panel.html.bak
   - 复制 cascade-panel.html 与 cascade-panel/ 到 extensions/antigravity/
   - 备份 workbench-jetski-agent.html -> workbench-jetski-agent.html.bak
   - 复制 workbench-jetski-agent.html 与 manager-panel/ 到 workbench/
5. 重新打开 Antigravity 与 Manager 窗口

## 配置开关

可在以下位置修改补丁配置。

- 侧边栏: extensions/antigravity/cascade-panel/config.json
- Manager: out/vs/code/electron-browser/workbench/manager-panel/config.json

示例 (侧边栏):

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

示例 (Manager):

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

修改配置后，重新打开 Manager 窗口以应用更改。

## 注意事项

- ~~修改 workbench-jetski-agent.html 会触发 扩展已损坏 提示~~ (v2.3.2+ 已修复)
- Antigravity 更新可能覆盖补丁. 若被覆盖, 请重新安装.
