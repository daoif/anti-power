# 更新日志

本文档记录 Anti-Power 各版本的更新内容.

[English](CHANGELOG_EN.md) | 中文

---

## v3.0.1 (2026-02-05)

### 新功能
- 清理工具新增支持 Gemini CLI, Codex 和 Claude Code, 默认仅选 Antigravity
- 清理工具新增启用开关, 防止误触
- 新增英文版脚本 `anti-power.en.sh`/`anti-clean.en.sh`

### 修复
- 修复英文模式下脚本输出为中文的问题

### 文档
- 手动安装说明补充英文脚本
- README/Changelog/Release Notes 同步至 v3.0.1

---

## v3.0.0 (2026-02-04)

### 新功能
- 中英文界面切换
- 深浅色主题切换
- 侧边栏与 Manager 功能卡片支持折叠/展开

### 优化
- 安装器布局重构为双栏响应式，清理工具根据屏幕自动调整位置
- 全面升级视觉样式（字体、色板、按钮、卡片、模态与动画）

### 修复
- 修复清理工具（macOS/Linux）运行逻辑，确保执行前经过二次确认

### 文档
- README/Changelog/Release Notes 同步至 v3.0.0
- README 更新支持的 Antigravity 版本至 v1.16.5，并统一 macOS 应用名为 `Anti-Power.app`

---

## v2.4.0 (2026-02-02)

### 新功能
- macOS 通用构建 (Universal Build) 支持
- 新增 `icon-gen` 图标生成工具脚本
- 新增 `npm run clean` 清理命令
- 依赖库升级

### 文档
- 同步跨平台安装说明
- 修正文档遗留问题

---

## v2.3.4 (2026-02-01)

> 社区贡献: 感谢 [@mikessslxxx](https://github.com/mikessslxxx) 的 PR #18

### 新功能
- macOS/Linux 跨平台支持
- 跨平台路径规范化与检测
- Unix 系统提权安装流程 (sudo/pkexec)
- GitHub Actions 自动化构建与发布

### 优化
- 路径检测增强, 支持 Linux 探测
- 前端适配 macOS Resources 路径
- 窗口装饰策略调整, 适配 macOS 系统标题栏

---

## v2.3.3 (2026-01-31)

### 修复
- 修复数学公式渲染失效的严重 BUG
- 临时回滚公式渲染机制至 v2.0.1 稳定版本逻辑
- 新增公式渲染模式切换功能 (经典模式/延迟模式)

---

## v2.3.2 (2026-01-31)

> 社区贡献: 感谢 [@mikessslxxx](https://github.com/mikessslxxx)

### 优化
- 数学公式渲染优化
- 复制按钮样式优化

### 新功能
- 复制按钮提供更多自定义选项 (样式, 位置等)

### 修复
- 修复 Manager 补丁导致 "安装似乎损坏" 提示的问题

---

## v2.3.1 (2026-01-31)

> 社区贡献: 感谢 [@Sophomoresty](https://github.com/Sophomoresty) 的 PR

### 新功能
- 右下角常驻复制按钮, 方便随时复制内容
- 开发者文档 (中英文双语)

### 优化
- KaTeX CSS 和 JS 并行加载, 加快首次公式渲染速度
- 右上角悬停按钮上移, 避免遮挡文字内容
- 代码块使用等宽字体栈 (Cascadia Code, Fira Code 等)
- 清理复制内容中的多余空行

### 修复
- 嵌套列表中的代码块及语言标识符正确识别
- 内联代码 (`pre.inline`) 正确提取为反引号格式
- 过滤 SVG 标签, 避免复制内容包含图标代码

### 变更
- 移除 good/bad 反馈区域的复制按钮 (减少界面干扰)
- Manager 功能 (mermaid, math) 默认启用

---

## v2.3.0 (2026-01-30)

### 新功能
- 复制功能支持 Markdown 格式保留 (标题/列表/加粗/斜体/链接等)

---

## v2.2.0 (2026-01-21)

> 社区贡献: 感谢 [@mikessslxxx](https://github.com/mikessslxxx)

### 新功能
- Manager 窗口 Mermaid 渲染
- Manager 窗口数学公式渲染
- Manager 窗口对话宽度调节
- Manager 窗口字号调节

---

## v2.1.0 (2026-01-19)

### 新功能
- 侧边栏字体大小调节
- Manager 窗口一键复制

### 优化
- Mermaid 渲染报错提示优化

---

## v2.0.1 (2026-01-14)

### 优化
- 性能优化

---

## v2.0.0 (2026-01-14)

### 新功能
- 全新 Tauri 安装工具
- 支持功能单独开关

---

## v1.2.1 (2026-01-13)

### 修复
- Bug 修复

---

## v1.2.0 (2026-01-13)

### 新功能
- Mermaid 流程图渲染

---

## v1.1.0 (2026-01-13)

> 社区贡献: 感谢 [@mikessslxxx](https://github.com/mikessslxxx)

### 新功能
- 数学公式渲染 (KaTeX)

---

## v1.0.0 (2026-01-13)

### 初始版本
- 一键复制按钮
- 表格颜色修复 (深色主题)
