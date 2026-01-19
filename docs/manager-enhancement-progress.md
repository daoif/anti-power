# Manager 窗口增强计划

> 创建日期：2026-01-14  
> 状态：**Manager 模块已接入安装器，功能持续迭代中**

## 📌 目标

在 Antigravity 的 **Manager 窗口**（Agent Manager）中实现类似 `cascade-panel.html` 的增强功能。

---

## 📦 项目文件

### 需要部署的文件（安装器使用）

| 源文件 | 目标路径 |
|--------|----------|
| `patcher/patches/workbench-jetski-agent.html` | `E:\Program Files\Antigravity\resources\app\out\vs\code\electron-browser\workbench\` |
| `patcher/patches/manager-panel/*` | 同上（`manager-panel/` 目录） |

### 开发/测试脚本

| 文件 | 说明 |
|------|------|
| `tests/connect-antigravity.js` | 连接调试端口，列出所有页面 |
| `tests/dump-manager-dom.js` | 导出 Manager 窗口 DOM 到 `tests/temp` |
| `tests/debug-manager.js` | 快速检查补丁加载与关键选择器 |
| `tests/debug-manager-advanced.js` | 深度诊断脚本 |

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

# 诊断补丁加载/渲染状态
node debug-manager.js
node debug-manager-advanced.js
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
5. **✅ Manager 模块已接入安装器** - `manager-panel/` 已可随补丁部署

---

## 🔍 Manager 窗口技术栈

- **框架**：React
- **样式**：TailwindCSS（原子类）
- **图标**：Lucide Icons (SVG)
- **入口 HTML**：`workbench-jetski-agent.html`
- **主脚本**：`jetskiAgent.js`

---

## 💡 下一步

1. **补齐渲染链路** - Mermaid / 数学公式 / 字号支持
2. **完善样式一致性** - 与侧边栏复制按钮视觉对齐
3. **完善调试脚本** - 快速定位 Manager 渲染问题

---

## 📝 备注

- 修改 `workbench-jetski-agent.html` 会导致 Antigravity 启动时显示"扩展已损坏"提示，但不影响使用
- 在目录中创建备份文件（如 `.bak`）不会触发该提示
