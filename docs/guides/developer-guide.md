# Anti-Power 开发文档

[English](developer-guide_EN.md) | 中文

## 项目概述

Anti-Power 是一个为 Antigravity IDE 提供增强功能的补丁工具, 主要增强侧边栏 (legacy: cascade-panel / modern: sidebar-panel) 和 Manager 窗口的内容复制功能.

## 目录结构

```
patcher/
├── src/                    # Tauri 前端 (Vue.js)
├── src-tauri/              # Tauri 后端 (Rust)
├── patches/
│   ├── cascade-panel/      # 侧边栏补丁模块
│   │   ├── cascade-panel.js    # 入口文件
│   │   ├── cascade-panel.css   # 样式
│   │   ├── constants.js        # 常量定义
│   │   ├── extract.js          # 内容提取核心逻辑
│   │   ├── copy.js             # 复制按钮功能
│   │   ├── scan.js             # DOM 扫描与按钮注入
│   │   ├── utils.js            # 工具函数
│   │   ├── math.js             # KaTeX 数学公式渲染
│   │   ├── mermaid.js          # Mermaid 图表渲染
│   │   └── icons.js            # 图标定义
│   ├── sidebar-panel/      # 新版侧边栏补丁模块 (workbench.html 入口)
│   │   ├── sidebar-panel.js    # 入口文件
│   │   ├── sidebar-panel.css   # 样式
│   │   ├── constants.js        # 常量定义
│   │   ├── copy.js             # 复制按钮功能
│   │   ├── scan.js             # DOM 扫描与按钮注入
│   │   ├── utils.js            # 工具函数
│   │   ├── math.js             # KaTeX 数学公式渲染
│   │   └── mermaid.js          # Mermaid 图表渲染
│   └── manager-panel/      # Manager 窗口补丁模块
│       ├── manager-panel.js    # 入口文件
│       ├── manager-panel.css   # 样式
│       ├── constants.js        # 常量定义
│       ├── copy.js             # 内容提取与复制功能
│       ├── scan.js             # DOM 扫描与按钮注入
│       ├── utils.js            # 工具函数
│       ├── math.js             # KaTeX 数学公式渲染
│       └── mermaid.js          # Mermaid 图表渲染
└── docs/guides/            # 本文档所在目录
```

## 补丁安装位置

- **sidebar (legacy)**: `<Antigravity>/resources/app/extensions/antigravity/cascade-panel/`
- **sidebar (modern)**: `<Antigravity>/resources/app/out/vs/code/electron-browser/workbench/sidebar-panel/`
- **manager-panel**: `<Antigravity>/resources/app/out/vs/code/electron-browser/workbench/manager-panel/`

## 快速开发流程

无需每次构建 patcher, 直接复制文件即可测试:

```bash
# 从项目根目录进入 patcher 目录
cd patcher

# 复制 sidebar legacy (示例路径)
cp ./patches/cascade-panel/*.js ./patches/cascade-panel/*.css "E:/Antigravity/resources/app/extensions/antigravity/cascade-panel/"

# 复制 sidebar modern (示例路径)
cp ./patches/sidebar-panel/*.js ./patches/sidebar-panel/*.css "E:/Antigravity/resources/app/out/vs/code/electron-browser/workbench/sidebar-panel/"

# 复制 manager-panel (示例路径)
cp ./patches/manager-panel/*.js ./patches/manager-panel/*.css "E:/Antigravity/resources/app/out/vs/code/electron-browser/workbench/manager-panel/"
```

然后在 Antigravity 中:
1. 按 `Ctrl+Shift+I` 打开开发者工具
2. 按 `Ctrl+R` 刷新页面

**注意**: Manager 窗口是独立的, 需要单独刷新.

## Manager 调试

Manager 窗口无法使用内置 DevTools, 建议使用 9222 + Playwright, 详见 [tests/README.md](../../tests/README.md).

## 核心模块说明

### extract.js/copy.js (内容提取)

负责从 DOM 中提取内容并转换为 Markdown 格式.

**支持的内容类型**:
- 代码块 (带语言标识)
- 内联代码 (`pre.inline` 结构)
- 有序列表/无序列表 (支持嵌套)
- 表格
- 数学公式 (KaTeX/MathJax, 恢复 LaTeX 源码)
- Mermaid 图表 (恢复源码)
- 标题 (转换为 # 格式)

**关键函数**:
- `extractFormattedContent()` / `extractFormattedText()` - 主提取函数
- `extractCodeBlockContent()` - 提取代码块, 自动查找语言标识
- `extractListItemContent()` - 提取列表项内容
- `extractOrderedList()` / `extractUnorderedList()` - 递归处理嵌套列表
- `extractLatexFromMath()` - 从渲染的公式中恢复 LaTeX
- `extractTable()` - 表格转 Markdown

### constants.js

定义共享常量:
- `BUTTON_CLASS` - 右上角复制按钮类名
- `BOTTOM_BUTTON_CLASS` - 右下角复制按钮类名
- `BOUND_ATTR` - 标记已绑定复制功能的属性
- `RAW_TEXT_PROP` - 缓存原始文本的属性名
- `MERMAID_SOURCE_PROP` - 缓存 Mermaid 源码的属性名
- `COMMON_LANGS` - 常见编程语言集合 (用于过滤噪音)

### scan.js

DOM 变化监听与按钮注入:
- 使用 MutationObserver 监听 DOM 变化
- 自动为内容区域添加复制按钮
- 处理 Mermaid 和数学公式的渲染

## DOM 结构说明

### 内联代码
```html
<pre class="inline"><code class="...">code content</code></pre>
```
应提取为: `` `code content` ``

### 代码块
```html
<pre>
  <div>
    <div class="font-sans">c</div>  <!-- 语言标识显示 -->
  </div>
  <div class="language-c ...">      <!-- language-xxx 在这里 -->
    <div class="code-block">
      <div class="code-line">
        <div class="line-content">code line 1</div>
      </div>
      ...
    </div>
  </div>
</pre>
```
`extractCodeBlockContent()` 会依次查找:
1. 当前元素的 class
2. 子元素中的 `[class*="language-"]`
3. 父元素的 class

### 列表结构
```html
<ol>
  <li>
    text content
    <pre class="inline"><code>inline code</code></pre>
    <pre>...</pre>  <!-- 代码块 -->
    <ul>          <!-- 嵌套列表 -->
      <li>...</li>
    </ul>
  </li>
</ol>
```

## 当前开发进度

### 已完成功能

- [x] 基础复制功能 (右上角悬停 + 右下角常驻按钮)
- [x] 代码块提取 (带语言标识)
- [x] 内联代码提取 (`pre.inline` -> 反引号)
- [x] 嵌套列表支持 (有序/无序, 递归处理)
- [x] 表格转 Markdown
- [x] 数学公式恢复 LaTeX 源码
- [x] Mermaid 图表恢复源码
- [x] 标题转 Markdown # 格式
- [x] 过滤 STYLE/SCRIPT/SVG 等标签
- [x] 过滤复制按钮文本
- [x] 内联代码等宽字体样式修复 (sidebar legacy/modern)
- [x] 移除空行优化 Markdown 格式
- [x] KaTeX CSS 和 JS 并行加载优化

### 已知问题

- [ ] **Manager 代码块缺少语言标识**
  - 原因: Manager DOM 不提供 `language-xxx` class 或其他可识别语言信息 (上游限制)
  - 备注: 详见 [known-issues.md](../reference/known-issues.md)

### 待完善功能

- [ ] 更多边界情况处理
- [ ] 单元测试

## 代码规范

### 命名约定
- cascade-panel 使用 `cascade-` 前缀 (如 `cascade-copy-button`)
- sidebar-panel 使用 `sidebar-` 前缀 (如 `sidebar-copy-btn`)
- manager-panel 使用 `manager-` 前缀 (如 `manager-copy-btn`)

### 提取逻辑同步
侧边栏模块 (`cascade-panel` / `sidebar-panel`) 与 `manager-panel` 的提取逻辑应保持同步. 修改一处时需同步另一处.

### 跳过元素的方式
使用 `skipUntilEndOfBlock` 变量配合 `contains()` 检查来跳过已处理的子树:
```javascript
if (skipUntilEndOfBlock && skipUntilEndOfBlock.contains(currentNode)) {
    continue;
}
```

### 需要跳过的内容
- `SKIP_TAGS`: STYLE, SCRIPT, NOSCRIPT, TEMPLATE, SVG
- 复制按钮元素及其内部文本
- 已处理的代码块/公式/列表内部文本
- 文件图标容器 (`show-file-icons`, `file-icon`)

## 构建发布

```bash
cd patcher
npm run tauri:build
```

构建产物: `src-tauri/target/release/anti-power.exe`

## 版本历史

### v2.3.x (社区增强)
- KaTeX CSS 和 JS 并行加载, 加快首次渲染速度
- 右下角常驻复制按钮, 移除 good/bad 旁边的复制按钮
- 右上角复制按钮上移, 避免遮挡文字
- 侧边栏/Manager 嵌套列表支持, 代码块语言标识识别
- 内联代码 (`pre.inline`) 正确提取为反引号格式
- SVG 标签过滤, 避免复制内容包含图标代码
- 清理复制内容中的多余空行
- Manager 功能 (mermaid, math) 默认启用

### v2.3.0
- 复制功能优化: 支持 Markdown 格式保留 (标题/列表/加粗/斜体/链接等)

### v2.2.0
- 添加 Manager 功能支持
- 添加右下角常驻复制按钮
- 修复内联代码提取问题
- 修复嵌套列表支持
- 优化代码块语言标识提取
