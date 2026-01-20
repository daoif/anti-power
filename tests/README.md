# Manager 调试说明

用 Playwright 连接 9222 端口远程调试 Manager 窗口。

## 调试方式 (推荐优先级从高到低)

### 方式 1: 远程调试脚本 (推荐)

1. 启动 Antigravity 调试模式:

```powershell
& "<Antigravity安装目录>\Antigravity.exe" --remote-debugging-port=9222
```

2. 手动打开 Manager 窗口, 然后运行脚本:

```powershell
cd tests
node debug-manager.js
node debug-manager-advanced.js
```

可选工具:
- `connect-antigravity.js`: 列出所有页面, 需要传入 WebSocket URL
- `dump-manager-dom.js`: 导出 Manager DOM 到 `tests/temp`, 需要传入 WebSocket URL
- `capture-logs.js`: 捕获 Manager 控制台日志

WebSocket URL 可通过 `http://127.0.0.1:9222/json/version` 查看.

### 方式 2: 重新打补丁后手动验证

1. 重新安装补丁
2. 关闭并重新打开 Manager 窗口
3. 手动查看渲染效果

## 重要约束

- 优先使用现有脚本进行诊断
- 如需临时验证, 优先使用 `node -e` 或在现有脚本中临时加日志
- `tests/temp` 是调试输出目录, 可以手动清理
