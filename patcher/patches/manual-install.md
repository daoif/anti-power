# Anti-Power 补丁手动安装说明

适用于 Windows 和 macOS 的手动安装与配置.

## 适用场景

- Windows: 推荐优先使用 anti-power.exe 安装器, 也可手动安装
- macOS: 推荐优先使用 anti-power-macOS.sh 脚本, 也可手动安装

## 补丁包内容

- anti-power-macOS.sh (macOS 安装脚本)
- cascade-panel.html
- cascade-panel/ 目录
- workbench-jetski-agent.html
- manager-panel/ 目录
- manual-install.md (本文档)

## Windows (推荐: 安装器方式)

1. 下载 anti-power.exe
2. 双击运行, 自动检测 Antigravity 安装路径
3. 勾选功能并点击 安装补丁
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

## macOS (推荐: 脚本方式)

1. 解压补丁包, 打开 Terminal (终端) 进入目录
2. 赋予脚本执行权限:
   ```bash
   chmod +x ./anti-power-macOS.sh
   ```
3. 运行脚本 (需要 sudo 权限):
   ```bash
   sudo ./anti-power-macOS.sh
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

补丁会在以下路径生成配置文件, 可按需修改:

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

修改配置后, 建议重新打开 Manager 窗口以生效.

## 注意事项

- ~~修改 workbench-jetski-agent.html 会触发 扩展已损坏 提示~~ (v2.3.2+ 已修复)
- Antigravity 官方更新可能覆盖补丁, 需要重新安装
