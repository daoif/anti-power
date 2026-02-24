/**
 * Keep modern Sidebar selectors and resources independent of the legacy Cascade Panel
 * Override CDN URLs through window globals to use local or mirrored assets
 */

// Selectors for Antigravity Sidebar message content
export const PANEL_SELECTOR = '.antigravity-agent-side-panel';
export const CONTENT_SELECTOR = '.leading-relaxed.select-text';
export const SECTION_SELECTOR = '[data-section-index]';

export const BOUND_ATTR = 'data-sidebar-copy-bound';
export const MATH_ATTR = 'data-sidebar-math-rendered';
export const MERMAID_ATTR = 'data-sidebar-mermaid-rendered';

export const BUTTON_CLASS = 'sidebar-copy-button';
export const BOTTOM_BUTTON_CLASS = 'sidebar-copy-bottom';
export const COPY_BTN_CLASS = 'sidebar-copy-btn';
export const MERMAID_CONTAINER_CLASS = 'sidebar-mermaid-container';
export const MERMAID_COPY_BTN_CLASS = 'sidebar-mermaid-copy';

export const RAW_TEXT_PROP = '__sidebarRawText';
export const MERMAID_SOURCE_PROP = '__sidebarMermaidSource';

export const MATH_HINT_RE = /\$\$|\\\(|\\\[|\\begin\{|\$(?!\s)([^$\n]+?)\$/;

// KaTeX CDN
export const KATEX_VERSION = '0.16.9';
const KATEX_BASE =
    window.SIDEBAR_KATEX_BASE_URL ||
    `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist`;
export const KATEX_CSS_URL = `${KATEX_BASE}/katex.min.css`;
export const KATEX_JS_URL = `${KATEX_BASE}/katex.min.js`;
export const KATEX_AUTO_URL = `${KATEX_BASE}/contrib/auto-render.min.js`;

// MathJax CDN
export const MATHJAX_URL =
    window.SIDEBAR_MATHJAX_URL ||
    'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';

// Mermaid CDN
export const MERMAID_VERSION = '10.9.0';
export const MERMAID_URL =
    window.SIDEBAR_MERMAID_URL ||
    `https://cdn.jsdelivr.net/npm/mermaid@${MERMAID_VERSION}/dist/mermaid.min.js`;
