/**
 * Cascade Panel 补丁常量定义
 *
 * 本模块定义补丁核心常量，包括：
 * - DOM 选择器与标记属性
 * - CDN 资源配置（KaTeX、MathJax、Mermaid）
 * - 通用语言集合
 *
 * 支持通过全局变量覆盖 CDN 地址以适应离线或镜像环境。
 */

// 内容扫描的选择器，控制功能覆盖的 DOM 范围
export const CONTENT_SELECTOR = '.prose, .prose-sm, [data-in-html-content]';
export const BOUND_ATTR = 'data-cascade-copy-bound';
export const BUTTON_CLASS = 'cascade-copy-button'; // Main content copy button (top-right)
export const COPY_BTN_CLASS = 'cascade-copy-btn'; // Generic copy button style
export const MATH_ATTR = 'data-cascade-math-rendered';
export const RAW_TEXT_PROP = '__cascadeRawText';
export const MATH_HINT_RE = /\$\$|\\\(|\\\[|\\begin\{|\$(?!\s)([^$\n]+?)\$/;

// KaTeX CDN 配置（允许通过全局变量覆盖 base URL）
export const KATEX_VERSION = '0.16.9';
const KATEX_BASE =
    window.CASCADE_KATEX_BASE_URL ||
    `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist`;
export const KATEX_CSS_URL = `${KATEX_BASE}/katex.min.css`;
export const KATEX_JS_URL = `${KATEX_BASE}/katex.min.js`;
export const KATEX_AUTO_URL = `${KATEX_BASE}/contrib/auto-render.min.js`;

// MathJax CDN 配置（允许通过全局变量覆盖 URL）
export const MATHJAX_URL =
    window.CASCADE_MATHJAX_URL ||
    'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';

// Mermaid CDN 配置（允许通过全局变量覆盖 URL）
export const MERMAID_VERSION = '10.9.0';
export const MERMAID_URL =
    window.CASCADE_MERMAID_URL ||
    `https://cdn.jsdelivr.net/npm/mermaid@${MERMAID_VERSION}/dist/mermaid.min.js`;
export const MERMAID_ATTR = 'data-cascade-mermaid-rendered';
export const MERMAID_SOURCE_PROP = '__cascadeMermaidSource';
export const MERMAID_CONTAINER_CLASS = 'cascade-mermaid-container';
export const MERMAID_COPY_BTN_CLASS = 'cascade-mermaid-copy';

// 常见语言集合，用于过滤代码块标题等噪音文本
export const COMMON_LANGS = new Set([
    'xml',
    'html',
    'css',
    'javascript',
    'typescript',
    'python',
    'java',
    'json',
    'bash',
    'shell',
    'sql',
    'yaml',
    'markdown',
    'go',
    'rust',
    'c',
    'cpp',
    'csharp',
    'php',
    'ruby',
    'swift',
    'kotlin',
]);
