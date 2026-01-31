/**
 * Manager Panel 常量定义
 *
 * 本模块定义 Manager 窗口补丁的核心常量，完全独立于 cascade-panel。
 *
 * 包括：
 * - DOM 选择器与标记属性
 * - CDN 资源配置（KaTeX、MathJax、Mermaid）
 * - 按钮样式类名
 *
 * 支持通过全局变量覆盖 CDN 地址以适应离线或镜像环境。
 */

// Manager 内容区选择器（基于 DOM 分析结果）
export const CONTENT_SELECTOR = '.leading-relaxed.select-text';
export const SECTION_SELECTOR = '[data-section-index]';

// 渲染标记属性
export const BOUND_ATTR = 'data-manager-copy-bound';
export const MATH_ATTR = 'data-manager-math-rendered';
export const MERMAID_ATTR = 'data-manager-mermaid-rendered';

// 按钮样式类
export const BUTTON_CLASS = 'manager-copy-button';
export const COPY_BTN_CLASS = 'manager-copy-btn';
export const MERMAID_CONTAINER_CLASS = 'manager-mermaid-container';
export const MERMAID_COPY_BTN_CLASS = 'manager-mermaid-copy';

// 原始文本存储
export const RAW_TEXT_PROP = '__managerRawText';
export const MERMAID_SOURCE_PROP = '__managerMermaidSource';

// 数学公式检测正则
export const MATH_HINT_RE = /\$\$|\\\(|\\\[|\\begin\{|\$(?!\s)([^$\n]+?)\$/;

// KaTeX CDN
export const KATEX_VERSION = '0.16.9';
const KATEX_BASE =
    window.MANAGER_KATEX_BASE_URL ||
    `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist`;
export const KATEX_CSS_URL = `${KATEX_BASE}/katex.min.css`;
export const KATEX_JS_URL = `${KATEX_BASE}/katex.min.js`;
export const KATEX_AUTO_URL = `${KATEX_BASE}/contrib/auto-render.min.js`;

// MathJax CDN
export const MATHJAX_URL =
    window.MANAGER_MATHJAX_URL ||
    'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';

// Mermaid CDN
export const MERMAID_VERSION = '10.9.0';
export const MERMAID_URL =
    window.MANAGER_MERMAID_URL ||
    `https://cdn.jsdelivr.net/npm/mermaid@${MERMAID_VERSION}/dist/mermaid.min.js`;
