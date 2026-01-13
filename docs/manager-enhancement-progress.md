# Manager 窗口增强计划

> 创建日期：2026-01-14  
> 状态：**Hook 方案已验证，待实现功能**

## 📌 目标

在 Antigravity 的 **Manager 窗口**（Agent Manager）中实现类似 `cascade-panel.html` 的增强功能。

---

## 📦 项目文件

### 需要部署的文件

| 源文件 | 目标路径 |
|--------|----------|
| `workbench-jetski-agent.html` | `E:\Program Files\Antigravity\resources\app\out\vs\code\electron-browser\workbench\` |
| `manager-enhancement.js` | 同上 |

### 开发/测试文件

| 文件 | 说明 |
|------|------|
| `tests/connect-antigravity.js` | 连接调试端口，列出所有页面 |
| `tests/dump-manager-dom.js` | 导出 Manager 窗口的 DOM 结构 |
| `tests/manager-dom-full.html` | 导出的完整运行时 DOM（82KB） |

---

## 🔧 调试方法

### 前置条件

1. **关闭所有 Antigravity 窗口**
2. 使用调试命令启动 Antigravity
3. **手动打开 Manager 窗口**（否则 Playwright 无法获取其 DOM）

### 1. 启动 Antigravity 调试模式

```powershell
& "E:\Program Files\Antigravity\Antigravity.exe" --remote-debugging-port=9222
```

终端会输出 WebSocket URL：
```
DevTools listening on ws://127.0.0.1:9222/devtools/browser/xxxxxx-xxxx...
```

### 2. 使用 Playwright 连接

```powershell
cd e:\code\anti-power\tests

# 列出所有页面
node connect-antigravity.js "ws://127.0.0.1:9222/devtools/browser/你的UUID"

# 导出 Manager 窗口 DOM
node dump-manager-dom.js "ws://127.0.0.1:9222/devtools/browser/你的UUID"
```

> ⚠️ 每次重启 Antigravity，WebSocket URL 的 UUID 会变化

### 3. 页面识别

| 页面标题 | 说明 |
|----------|------|
| **Manager** | Agent Manager（对话管理器）✅ 目标窗口 |
| Launchpad | 项目选择器 |
| [项目名] - Antigravity | 主编辑器窗口 |

---

## ✅ 已完成

1. **Playwright 环境** - 安装在 `tests/` 目录
2. **远程调试连接** - 通过 `connectOverCDP` 成功连接
3. **DOM 结构导出** - 获取了 Manager 窗口完整 HTML
4. **🎉 Hook 方案验证成功** - 修改 `workbench-jetski-agent.html` 后红色边框立即生效
5. **增强脚本框架** - 创建了 `manager-enhancement.js` 占位文件

---

## 🔍 Manager 窗口技术栈

- **框架**：React
- **样式**：TailwindCSS（原子类）
- **图标**：Lucide Icons (SVG)
- **入口 HTML**：`workbench-jetski-agent.html`
- **主脚本**：`jetskiAgent.js`

---

## 💡 下一步

1. **导出带对话内容的 DOM** - 分析聊天区域结构
2. **确定改造点** - 对比侧边栏 `cascade-panel.html` 的增强方式
3. **实现 `manager-enhancement.js`** - 添加实际功能

---

## 📝 备注

- 修改 `workbench-jetski-agent.html` 会导致 Antigravity 启动时显示"扩展已损坏"提示，但不影响使用
- 在目录中创建备份文件（如 `.bak`）不会触发该提示
