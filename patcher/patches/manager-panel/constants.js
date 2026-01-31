/**
 * Keep Manager selectors and resources independent of the legacy Cascade Panel
 * Override CDN URLs through window globals to use local or mirrored assets
 */

// Selectors for Antigravity Manager message content
export const CONTENT_SELECTOR = '.leading-relaxed.select-text';
export const SECTION_SELECTOR = '[data-section-index]';

export const BOUND_ATTR = 'data-manager-copy-bound';
export const MATH_ATTR = 'data-manager-math-rendered';
export const MERMAID_ATTR = 'data-manager-mermaid-rendered';

export const BUTTON_CLASS = 'manager-copy-button';
export const BOTTOM_BUTTON_CLASS = 'manager-copy-bottom';
export const COPY_BTN_CLASS = 'manager-copy-btn';
export const MERMAID_CONTAINER_CLASS = 'manager-mermaid-container';
export const MERMAID_COPY_BTN_CLASS = 'manager-mermaid-copy';

export const RAW_TEXT_PROP = '__managerRawText';
export const MERMAID_SOURCE_PROP = '__managerMermaidSource';

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
