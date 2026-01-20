# Anti-Power 补丁手动安装说明
本指南介绍 Windows 和 macOS 上的手动安装与配置.

## 适用场景
- Windows: 推荐优先使用 anti-power.exe 安装器, 也可手动安装
- macOS: 当前仅支持手动安装

## 补丁包内容
- cascade-panel.html
- cascade-panel/ 目录
- workbench-jetski-agent.html
- manager-panel/ 目录
- manual-install.md (本文档)

## Windows (推荐: 安装器方式)
1. 下载 anti-power.exe
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

## macOS (手动安装)
1. 关闭所有 Antigravity 窗口
2. 打开 应用程序 (Applications) -> 右键 Antigravity -> 显示包内容
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
- 修改 workbench-jetski-agent.html 会触发 扩展已损坏 提示, 但不影响使用
- Antigravity 更新可能覆盖补丁. 若被覆盖, 请重新安装.
