/** Render math in Manager independently of the legacy Cascade Panel */

import {
    MATH_ATTR,
    MATH_HINT_RE,
    RAW_TEXT_PROP,
    KATEX_CSS_URL,
    KATEX_JS_URL,
} from './constants.js';
import { loadStyle, loadScript } from './utils.js';

let katexLoaded = false;
let katexLoading = null;
const DELIMITERS = [
    { left: '$$', right: '$$', display: true },
    { left: '\\[', right: '\\]', display: true },
    { left: '\\(', right: '\\)', display: false },
    { left: '$', right: '$', display: false },
];

const reloadScript = async (src) => {
    const scripts = document.querySelectorAll(`script[src="${src}"]`);
    scripts.forEach((script) => {
        script.parentNode?.removeChild(script);
    });
    await loadScript(src);
};

const ensureKatex = async () => {
    if (katexLoaded) return true;
    if (katexLoading) return katexLoading;

    katexLoading = (async () => {
        try {
            await loadStyle(KATEX_CSS_URL);
            await loadScript(KATEX_JS_URL);
            if (!window.katex) {
                await reloadScript(KATEX_JS_URL);
            }
            if (!window.katex?.renderToString) {
                return false;
            }
            katexLoaded = true;
            return true;
        } catch (err) {
            console.warn('[Manager] KaTeX 加载失败:', err);
            return false;
        }
    })();

    return katexLoading;
};

const isEscaped = (text, index) => {
    let slashCount = 0;
    for (let i = index - 1; i >= 0 && text[i] === '\\'; i -= 1) {
        slashCount += 1;
    }
    return slashCount % 2 === 1;
};

const findNextDelimiter = (text, startIndex) => {
    let match = null;

    for (const delimiter of DELIMITERS) {
        const idx = text.indexOf(delimiter.left, startIndex);
        if (idx === -1) continue;

        if (delimiter.left === '$') {
            if (isEscaped(text, idx)) continue;
            const nextChar = text[idx + 1];
            if (nextChar && /\s/.test(nextChar)) continue;
        }

        if (!match || idx < match.index || (idx === match.index && delimiter.left.length > match.delimiter.left.length)) {
            match = { index: idx, delimiter };
        }
    }

    return match;
};

const findEndDelimiter = (text, startIndex, delimiter) => {
    let idx = text.indexOf(delimiter.right, startIndex);
    while (idx !== -1) {
        if (!isEscaped(text, idx)) {
            if (delimiter.right === '$') {
                const prevChar = text[idx - 1];
                const nextChar = text[idx + 1];
                if (prevChar && /\s/.test(prevChar)) {
                    idx = text.indexOf(delimiter.right, idx + delimiter.right.length);
                    continue;
                }
                if (nextChar === '$') {
                    idx = text.indexOf(delimiter.right, idx + delimiter.right.length);
                    continue;
                }
            }
            return idx;
        }
        idx = text.indexOf(delimiter.right, idx + delimiter.right.length);
    }
    return -1;
};

const splitWithDelimiters = (text) => {
    const tokens = [];
    let pos = 0;

    while (pos < text.length) {
        const found = findNextDelimiter(text, pos);
        if (!found) {
            tokens.push({ type: 'text', data: text.slice(pos) });
            break;
        }

        if (found.index > pos) {
            tokens.push({ type: 'text', data: text.slice(pos, found.index) });
        }

        const start = found.index + found.delimiter.left.length;
        const end = findEndDelimiter(text, start, found.delimiter);
        if (end === -1) {
            tokens.push({ type: 'text', data: text.slice(found.index) });
            break;
        }

        const math = text.slice(start, end);
        tokens.push({
            type: 'math',
            data: math,
            display: found.delimiter.display,
            left: found.delimiter.left,
            right: found.delimiter.right,
        });

        pos = end + found.delimiter.right.length;
    }

    return tokens;
};

const renderKatexHtml = (latex, displayMode) => {
    if (!window.katex?.renderToString) return null;
    return window.katex.renderToString(latex, {
        displayMode,
        throwOnError: false,
        trust: true,
    });
};

const createFragmentFromHtml = (html) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const fragment = document.createDocumentFragment();
    doc.body.childNodes.forEach((node) => {
        fragment.appendChild(document.importNode(node, true));
    });
    return fragment;
};

const shouldSkipTextNode = (node) => {
    const parent = node.parentElement;
    if (!parent) return true;
    if (parent.closest('pre, code, .code-block')) return true;
    if (parent.closest('.manager-mermaid-container, .katex, .katex-display, mjx-container')) return true;
    return false;
};

const renderMathIntoElement = (el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    let node;

    while ((node = walker.nextNode())) {
        if (shouldSkipTextNode(node)) continue;
        if (!node.textContent || !MATH_HINT_RE.test(node.textContent)) continue;
        textNodes.push(node);
    }

    textNodes.forEach((textNode) => {
        const tokens = splitWithDelimiters(textNode.textContent || '');
        if (tokens.length === 1 && tokens[0].type === 'text') return;

        const fragment = document.createDocumentFragment();
        tokens.forEach((token) => {
            if (token.type === 'text') {
                if (token.data) {
                    fragment.appendChild(document.createTextNode(token.data));
                }
                return;
            }

            const html = renderKatexHtml(token.data, token.display);
            if (!html) {
                fragment.appendChild(document.createTextNode(`${token.left}${token.data}${token.right}`));
                return;
            }

            try {
                const mathFragment = createFragmentFromHtml(html);
                fragment.appendChild(mathFragment);
            } catch {
                fragment.appendChild(document.createTextNode(`${token.left}${token.data}${token.right}`));
            }
        });

        textNode.replaceWith(fragment);
    });
};

/** @param {HTMLElement} el */
export const renderMath = async (el) => {
    if (!el || el.hasAttribute(MATH_ATTR)) return;

    const text = el.textContent || '';
    if (!MATH_HINT_RE.test(text)) return;

    // Cache the original text for copying before inserting rendered math
    if (!el[RAW_TEXT_PROP]) {
        el[RAW_TEXT_PROP] = text;
    }

    const loaded = await ensureKatex();
    if (!loaded || !window.katex?.renderToString) return;

    el.setAttribute(MATH_ATTR, '1');

    try {
        renderMathIntoElement(el);
    } catch (err) {
        console.warn('[Manager] 数学公式渲染失败:', err);
    }
};
