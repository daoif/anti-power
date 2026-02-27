/**
 * Sidebar Panel 数学公式渲染
 *
 * 本模块负责 Sidebar 面板的数学公式渲染，完全独立于 cascade-panel。
 *
 * 渲染策略：
 * - 使用 KaTeX 进行渲染（不使用 auto-render）
 * - 手动解析公式分隔符并逐个渲染
 * - 使用 katex.render 直接渲染到 DOM，避免 innerHTML
 *
 * 支持的公式语法：
 * - 行内公式：$...$ 或 \(...\)
 * - 块级公式：$$...$$ 或 \[...\]
 *
 * 特殊处理：
 * - 绕过 Trusted Types 限制（不使用 innerHTML）
 * - 保留原始文本用于复制功能
 */

import {
    MATH_ATTR,
    MATH_HINT_RE,
    RAW_TEXT_PROP,
    KATEX_CSS_URL,
    KATEX_JS_URL,
} from './constants.js';
import { loadStyle, loadScript, withTrustedHTML } from './utils.js';

let katexLoaded = false;
let katexLoading = null;
const MATH_TEXT_SNAPSHOT_PROP = '__sidebarMathTextSnapshot';
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

/**
 * 加载 KaTeX 库
 *
 * 使用 Promise 缓存避免重复加载。
 *
 * @returns {Promise<boolean>} true 表示加载成功
 */
const ensureKatex = async () => {
    if (katexLoaded) return true;
    if (!katexLoading) {
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
                console.warn('[Sidebar] KaTeX 加载失败:', err);
                return false;
            }
        })();
    }

    const loaded = await katexLoading;
    if (!loaded) {
        // 失败不缓存，后续渲染触发时允许重试
        katexLoading = null;
    }
    return loaded;
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

/**
 * 直接使用 katex.render 渲染公式到元素
 * 避免使用 DOMParser（会被 Trusted Types 阻止）
 */
const renderKatexToElement = (latex, displayMode, container) => {
    if (!window.katex?.render) return false;
    try {
        window.katex.render(latex, container, {
            displayMode,
            throwOnError: false,
            trust: true,
        });
        return true;
    } catch {
        return false;
    }
};

const shouldSkipTextNode = (node) => {
    const parent = node.parentElement;
    if (!parent) return true;
    if (parent.closest('pre, code, .code-block')) return true;
    if (parent.closest('.sidebar-mermaid-container, .katex, .katex-display, mjx-container, .katex-inline-wrapper, .katex-display-wrapper')) return true;
    return false;
};

const shouldSkipElementNode = (node) => {
    if (!node) return true;
    if (node.closest('pre, code, .code-block')) return true;
    if (node.closest('.sidebar-mermaid-container, .katex, .katex-display, mjx-container, .katex-inline-wrapper, .katex-display-wrapper')) return true;
    return false;
};

const findNextDollarDelimiter = (text, startIndex) => {
    let match = null;
    const delimiters = ['$$', '$'];

    for (const delimiter of delimiters) {
        const idx = text.indexOf(delimiter, startIndex);
        if (idx === -1) continue;
        if (isEscaped(text, idx)) continue;

        if (delimiter === '$') {
            const nextChar = text[idx + 1];
            if (nextChar && /\s/.test(nextChar)) continue;
        }

        if (!match || idx < match.index || (idx === match.index && delimiter.length > match.delimiter.length)) {
            match = { index: idx, delimiter };
        }
    }

    return match;
};

const collectDollarMathRanges = (text) => {
    const ranges = [];
    let pos = 0;

    while (pos < text.length) {
        const found = findNextDollarDelimiter(text, pos);
        if (!found) break;

        const start = found.index + found.delimiter.length;
        const end = findEndDelimiter(text, start, { right: found.delimiter });
        if (end === -1) {
            pos = found.index + found.delimiter.length;
            continue;
        }

        ranges.push({ start, end });
        pos = end + found.delimiter.length;
    }

    return ranges;
};

const restoreUnderscoreInDollarMath = (el) => {
    if (!el || shouldSkipElementNode(el)) return;

    let restored = false;
    let segment = [];

    const flushSegment = () => {
        if (!segment.length) return;

        const hasFormat = segment.some((unit) => unit.type === 'format');
        if (!hasFormat) {
            segment = [];
            return;
        }

        let mergedText = '';
        let cursor = 0;
        segment.forEach((unit) => {
            unit.start = cursor;
            mergedText += unit.text;
            cursor += unit.text.length;
            unit.end = cursor;
        });

        if (!mergedText.includes('$')) {
            segment = [];
            return;
        }

        const ranges = collectDollarMathRanges(mergedText);
        if (!ranges.length) {
            segment = [];
            return;
        }

        segment.forEach((unit) => {
            if (unit.type !== 'format') return;
            const inDollarMath = ranges.some((range) => unit.start >= range.start && unit.end <= range.end);
            if (!inDollarMath) return;
            unit.node.replaceWith(document.createTextNode(`${unit.marker}${unit.text}${unit.marker}`));
            restored = true;
        });

        segment = [];
    };

    const children = Array.from(el.childNodes);
    children.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
            if (shouldSkipTextNode(child)) {
                flushSegment();
                return;
            }
            const text = child.textContent || '';
            if (!text) {
                flushSegment();
                return;
            }
            segment.push({ type: 'text', text });
            return;
        }

        if (child.nodeType !== Node.ELEMENT_NODE) {
            flushSegment();
            return;
        }

        if (shouldSkipElementNode(child)) {
            flushSegment();
            return;
        }

        const tagName = child.tagName.toLowerCase();
        if (tagName === 'em' || tagName === 'strong') {
            const text = child.textContent || '';
            if (!text) {
                flushSegment();
                return;
            }
            segment.push({
                type: 'format',
                node: child,
                text,
                marker: tagName === 'strong' ? '__' : '_',
            });
            return;
        }

        flushSegment();
        restoreUnderscoreInDollarMath(child);
    });

    flushSegment();
    if (restored) {
        // 仅在同一父节点片段内合并文本，避免跨元素误合并
        el.normalize();
    }
};

const renderMathIntoElement = (el) => {
    restoreUnderscoreInDollarMath(el);

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

            // 使用 katex.render 直接渲染到 span 元素
            const mathSpan = document.createElement('span');
            mathSpan.className = token.display ? 'katex-display-wrapper' : 'katex-inline-wrapper';

            const success = renderKatexToElement(token.data, token.display, mathSpan);
            if (!success) {
                // 渲染失败，保留原始文本
                mathSpan.textContent = `${token.left}${token.data}${token.right}`;
            }

            fragment.appendChild(mathSpan);
        });

        textNode.replaceWith(fragment);
    });
};

/**
 * 渲染元素内的数学公式
 *
 * 已渲染节点会跳过，避免重复处理。
 *
 * @param {HTMLElement} el - 内容元素
 * @returns {Promise<void>}
 */
export const renderMath = async (el) => {
    if (!el) return;
    const text = el.textContent || '';

    // 文本未变化时跳过，避免重复渲染；发生流式增量更新时允许重渲染
    if (el.hasAttribute(MATH_ATTR) && el[MATH_TEXT_SNAPSHOT_PROP] === text) return;

    if (!MATH_HINT_RE.test(text)) return;

    // 保存原始文本
    if (!el[RAW_TEXT_PROP]) {
        el[RAW_TEXT_PROP] = text;
    }

    const loaded = await ensureKatex();
    if (!loaded || !window.katex?.renderToString) return;

    try {
        await withTrustedHTML(() => {
            renderMathIntoElement(el);
        });
        el.setAttribute(MATH_ATTR, '1');
        el[MATH_TEXT_SNAPSHOT_PROP] = el.textContent || '';
    } catch (err) {
        console.warn('[Sidebar] 数学公式渲染失败:', err);
        // 保留重试机会，避免一次失败后被标记锁死
        el.removeAttribute(MATH_ATTR);
    }
};
