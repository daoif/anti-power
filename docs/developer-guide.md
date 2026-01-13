# 开发者调试指南

调试 Antigravity 并开发界面补丁。

## 🔍 获取 DOM 结构的方法

### 方法一：内置开发者工具（推荐用于主窗口/侧边栏）

1. 在 Antigravity 主窗口中按 `Ctrl+Shift+P`
2. 输入 **"开发人员:切换开发人员工具"** 或 **"Developer: Toggle Developer Tools"**
3. 即可打开控制台，查看任意位置的 DOM 结构（包括侧边栏）

### 方法二：Playwright 远程调试（用于 Manager 窗口）

Manager 窗口需要通过 Playwright 远程调试。

1. **关闭所有 Antigravity 窗口**
2. 使用调试模式启动：
   ```powershell
   & "<Antigravity安装目录>\Antigravity.exe" --remote-debugging-port=9222
   ```
3. **手动打开 Manager 窗口**
4. 复制终端输出的 WebSocket URL
5. 运行 Playwright 脚本：
   ```powershell
   cd tests
   node dump-manager-dom.js "ws://127.0.0.1:9222/devtools/browser/你的UUID"
   ```

---

## 🎯 已知 Hook 点

| Hook 点 | 文件路径 | 影响范围 |
|---------|----------|----------|
| **侧边栏面板** | `extensions/antigravity/cascade-panel.html` | Cascade 对话侧边栏 |
| **Manager 窗口** | `out/vs/code/electron-browser/workbench/workbench-jetski-agent.html` | Agent Manager 独立窗口 |

---

## 📁 重要目录和文件

以下路径相对于 Antigravity 安装目录（如 `C:\Program Files\Antigravity\`）：

```
<安装目录>/
└── resources/
    └── app/
        ├── extensions/
        │   └── antigravity/
        │       └── cascade-panel.html      ← 侧边栏 Hook 点
        │
        └── out/
            └── vs/
                └── code/
                    └── electron-browser/
                        └── workbench/
                            ├── workbench.html              ← 主编辑器窗口
                            ├── workbench-jetski-agent.html ← Manager Hook 点
                            └── jetskiAgent.js              ← Manager 主脚本
```

---

## 📝 备注

- 修改 `workbench-jetski-agent.html` 会导致 Antigravity 启动时显示"扩展已损坏"提示，但不影响正常使用
- Manager 窗口使用 React + TailwindCSS 技术栈
- 侧边栏面板通过 iframe 加载 `cascade-panel.html`
