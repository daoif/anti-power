# Anti-Power 项目 AI 开发指南 (GEMINI.md)

这份文档旨在帮助 AI 大模型（如 Gemini、Claude 等）快速理解本项目的背景、架构、核心逻辑和开发规范，以便更好地协助开发者进行维护和二次开发。

## 1. 项目简介

- **项目名称:** Anti-Power
- **项目定位:** 针对 Antigravity AI IDE 的增强补丁程序。
- **核心功能:** 增强 IDE 的侧边栏对话区域 (cascade-panel) 和独立的 Manager 窗口。提 Mermaid 渲染、LaTeX 数学公式渲染、一键复制为 Markdown 格式、修复深色主题下不可见的表格颜色，以及提供界面布局调节（如字号、宽度等）。
- **支持平台:** Windows, macOS (Intel/Apple Silicon), Linux。

## 2. 目录结构与核心模块

本项目主要分为“目标产物（注入到 IDE 中的补丁脚本）”和“安装器应用程序”两部分：

- `patcher/`：独立的桌面安装器项目根目录。采用 **Tauri + Vue 3** 构建。
  - `patcher/src/`：安装器前端 UI 代码。包含配置选项卡、安装和卸载按钮等用户交互界面。
  - `patcher/src-tauri/`：后端逻辑层 (Rust)。负责执行系统级操作，如检测 Antigravity 的安装路径、执行文件的备份与覆写、保存本地配置，以及在 macOS/Linux 等环境下的提权操作。
  - `patcher/patches/`：**核心补丁脚本** 和静态资源。这里的文件将在编译时嵌入到安装器中，并在安装时注入到 Antigravity 内部。
    - `cascade-panel.html` & `cascade-panel/`：用于增强侧边栏。
    - `workbench-jetski-agent.html` & `manager-panel/`：用于增强 Manager 窗口。
- `docs/`：项目相关文档。包括使用者手册、开发者指南 (`developer-guide.md`)。
- `tests/`：包含利用 Playwright 远程调试目标程序 DOM 等相关测试或脚本。
- `AGENTS_ZH.md` / `AGENTS.md`：精简版上下文，是提供给 Agent 阅读的入口文件之一。
- `README.md` / `README_EN.md`：项目对外介绍和用户手动安装指南。

## 3. 补丁工作原理

Anti-Power 是一个**直接修改本地应用文件（物理替换）**的补丁：

1. **寻址:** Tauri 客户端后端自动匹配系统环境和常规路径，定位目标软件 (Antigravity) 目录。
2. **备份:** 安装程序复制原版入口 HTML 文件（`cascade-panel.html` 及 `workbench-jetski-agent.html`）保存为 `.bak`。
3. **注入与修改:**
   - 载体：将 `patcher/patches/` 目录中的 HTML 文件和资源文件夹直接覆盖到 IDE 的特定 `resources/app/...` 路径下。
   - 挂载：IDE 重新启动对应 WebView 时，将会加载我们的 HTML 及包含的自定义 JS/CSS（如 `cascade-panel.js`）。
4. **防校验报错:** 核心逻辑包括修改 IDE 的 `product.json`，从 checksums 列表中移除已被篡改的 HTML 文件的哈希值，以此来防止 Antigravity 弹出“安装似乎损坏”的警告。

## 4. 前端补丁逻辑速览

注入到 IDE 中的自定义 JS/CSS 脚本是在 IDE 本身的 WebView/iframe 运行的，其核心工作流：

- **DOM 监听:** 使用 `MutationObserver` 等技术监听 AI 助手吐出的流式内容以及 DOM 节点变更。
- **静态资源解析:** 识别消息体内的特殊代码块（如 ` ```mermaid `）或公式标识符（`$...$` 等），再挂载并调用提前打包好的外部库 (KaTeX, Mermaid) 对这些结构进行渲染。
- **UI 增强与重写:** 在特定节点挂载我们设计的复制按钮、缩放按钮和悬浮工具栏；拦截默认表格的样式，利用 CSS 进行深浅模式重新适配。
- **复制拦截:** 对特定块的复制逻辑进行重写，以便于过滤 AI 的内在思考过程（Thinking），直接将渲染后的公式和图表还原为纯文本/Markdown 提供给用户剪贴板。

## 5. 开发规范与约束

在参与本项目开发或为本项目生成代码时，你需要时刻注意：

1. **中英标点规范:** 项目中的所有文档（包括纯中文环境）**一律强制使用英文标点符号**，防止某些脚本文本处理不一致或显示异常。
2. **嵌入清单限制:** Tauri 后端的 `build.rs` 会自动捆绑 `patcher/patches/` 参与发布构建。如果在这里增加仅仅是为了文档或配置的文件，记得在 `patcher/patches/.embed-exclude.txt` 中将其排除。
3. **跨系统权限:** Rust 代码涉及的本地磁盘写操作（如 `apply_patch`），必须兼顾 Windows（常规写权限）及 macOS/Linux（`resources/app` 在系统目录往往需要提权）。
4. **最小化干扰:** 保持对 Antigravity 项目最小巧的侵入式修改，非必要不增加被拦截文件。避免大规模破环官方特性。

## 6. AI 协作指北

当你被唤醒用于本项目的查缺补漏、Bug 修复和功能迭代时，你需要明确你的目标领域：

- 涉及**UI 开关或多语言面板** ➜ 查看并修改 `patcher/src/` (Vue3)。
- 涉及**核心功能（渲染错误、复制格式乱码、DOM 获取不准、样式冲突）** ➜ 查看并修改 `patcher/patches/` 即注入的 JS/HTML/CSS。
- 涉及**软件识别路径错误、安装提权失败、配置文件读写** ➜ 查看并修改 `patcher/src-tauri/` (Rust)。
- 提交任何变更前，请评估是否会影响多端（Win/Mac/Linux）和多入口（侧边栏、独立 Manager 窗口）的行为一致性。

## 7. Antigravity v1.107.0 更新后 DOM 变更调查 (2026-02-24)

> **背景:** Antigravity 更新至 v1.107.0 (Chrome/142.0.7444.175, Electron/39.2.3) 后, Anti-Power 插件的侧边栏 (cascade-panel) 字体大小修改和复制按钮注入功能全部失效。以下为通过 Playwright 远程调试 (端口 9222) dump DOM 后得出的调查结论。

### 7.1 旧注入机制已失效

| 旧版行为 | 新版 (v1.107.0) 行为 |
|---|---|
| 侧边栏加载独立的 `cascade-panel.html` (位于 `extensions/antigravity/` 下), 该文件由我们替换后引入自定义 JS/CSS | 侧边栏不再使用独立 HTML 入口, 而是作为 React 组件直接渲染在**主窗口** `workbench.html` 的 DOM 树中 |
| 侧边栏运行在独立 iframe/WebView 中, 有自己的 `document` | 侧边栏直接嵌入主进程页面, 与编辑器、终端等共享同一个 `document` |
| 通过替换 `cascade-panel.html` 注入 `<script type="module" src="./cascade-panel/cascade-panel.js">` | 由于物理 HTML 不再被加载, 脚本永远不会执行 |

**结论:** `patcher/patches/cascade-panel.html` 的替换注入方式对侧边栏已完全无效。

### 7.2 新版 DOM 结构特征

通过 `dump-all-html.js` 脚本导出的 `page-1-frame-0.html` (即主窗口 `workbench.html` 的运行时 DOM), 发现以下关键变化:

1. **入口 URL 变更:**
   - 主窗口: `vscode-file://vscode-app/.../workbench/workbench.html` (无变化)
   - 侧边栏面板现在由内部组件挂载, 不再有独立 URL

2. **CSS 类名体系变更:**
   - 旧版使用 `.prose`, `.prose-sm` 作为消息内容区域的选择器
   - 新版改用 Tailwind CSS 工具类组合, 例如:
     - `leading-relaxed select-text text-sm` (消息正文)
     - `break-words text-ide-text-color prose-a:text-ide-link-color` (消息容器)
     - `antigravity-agent-side-panel` (侧边栏根容器)
   - `.prose` / `.prose-sm` 类名在新版 DOM 中**已不存在**

3. **侧边栏容器结构:**
   - 根容器: `div.antigravity-agent-side-panel` (绝对定位)
   - 内部布局: `div.w-full.h-full.flex.flex-col.box-border`
   - 头部栏: `div.flex.items-center.justify-between.gap-2.px-2.py-[5.5px]`

4. **字体大小机制:**
   - 旧版: 在 `cascade-panel.html` 的 `<html>` 上设置 CSS 变量 `--cascade-panel-font-size`, 通过 CSS 规则 `html { font-size: var(--cascade-panel-font-size) }` 生效
   - 新版: 侧边栏共享主窗口的 `document`, 在 `:root` 上设置变量会影响整个 IDE, 不能再简单地修改根元素字号
   - 新版消息文本使用 Tailwind 的 `text-sm` (对应 `font-size: 0.875rem`), 受 `rem` 根字号控制

### 7.3 仍然有效的部分

- **Manager 窗口** (`workbench-jetski-agent.html`) 仍然是独立 HTML 入口, 现有注入方式应该仍然可用
- **`product.json` checksums 清理**逻辑仍然适用

### 7.4 待修复: 适配方案要点

以下为后续修复需要解决的核心问题 (尚未实施):

1. **注入点迁移:** 需要将侧边栏脚本的注入点从 `cascade-panel.html` 改为 `workbench.html`, 在其 `<body>` 末尾追加 `<script>` 标签, 同时需要更新 `CHECKSUMS_TO_REMOVE` 和 `patch.rs` 中的备份/写入逻辑
2. **选择器更新:** `CONTENT_SELECTOR` 需要从 `.prose, .prose-sm, [data-in-html-content]` 更新为新的 Tailwind 类组合 (如 `.leading-relaxed.select-text.text-sm` 等)
3. **作用域隔离:** 由于脚本现在运行在整个 IDE 的主窗口 `document` 中, 所有 DOM 操作必须限定在 `.antigravity-agent-side-panel` 容器内, 避免影响编辑器、终端等其他区域
4. **字体大小方案重新设计:** 不能再修改 `:root` 的 `font-size`, 需要改为:
   - 在 `.antigravity-agent-side-panel` 容器上设置 `font-size`
   - 或者通过更精确的选择器覆盖 `text-sm` 等 Tailwind 类的效果

### 7.5 调试工具与方法

本次调查使用的方法, 可供后续复现:

1. 启动 Antigravity 时附加参数: `--remote-debugging-port=9222`
2. 获取 WebSocket URL: `Invoke-RestMethod http://127.0.0.1:9222/json/version`
3. 运行 DOM 导出脚本: `node tests/scripts/dump-all-html.js <wsUrl>`
4. 导出的 HTML 文件存放在 `tests/temp/` 目录下, `page-1-frame-0.html` 对应主窗口
