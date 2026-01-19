# Manager 调试脚本说明

Manager 窗口无法使用内置 DevTools，只能通过 9222 + Playwright 获取页面信息。

## 启动方式

```powershell
& "<Antigravity安装目录>\\Antigravity.exe" --remote-debugging-port=9222
```

手动打开 Manager 窗口后再运行脚本。

## 常用脚本

- `connect-antigravity.js`：连接 9222 并列出页面
- `dump-manager-dom.js`：导出 HTML、DOM 树与关键元素到 `tests/temp`
- `debug-manager.js`：快速检查补丁加载状态
- `debug-manager-advanced.js`：深度诊断（资源加载、渲染状态、错误探测）

## 示例

```powershell
cd tests
node connect-antigravity.js "ws://127.0.0.1:9222/devtools/browser/你的UUID"
node dump-manager-dom.js "ws://127.0.0.1:9222/devtools/browser/你的UUID"
node debug-manager.js
node debug-manager-advanced.js
```

> 注意：如果 9222 未开启或 Manager 未打开，脚本会提示无法找到目标页面。
