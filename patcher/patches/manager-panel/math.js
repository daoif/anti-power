/**
 * Manager Panel 数学公式渲染
 * 完全独立于 cascade-panel
 */

import {
    KATEX_AUTO_URL,
    KATEX_CSS_URL,
    KATEX_JS_URL,
    MATH_ATTR,
    MATH_HINT_RE,
    MATHJAX_URL,
    RAW_TEXT_PROP,
} from './constants.js';
import { loadScript, loadStyle } from './utils.js';

let mathEngine = null;
let mathReadyPromise = null;

const isEditable = (el) => !!el?.closest?.('[contenteditable="true"], textarea, input');

const captureRawText = (contentEl) => {
    if (!contentEl) return;
    if (contentEl.getAttribute(MATH_ATTR) === '1') return;
    const raw = contentEl.innerText !== undefined
        ? contentEl.innerText
        : contentEl.textContent ?? '';
    contentEl[RAW_TEXT_PROP] = raw;
};

/**
 * 确保数学渲染引擎可用，优先 KaTeX，失败后回退 MathJax
 * @returns {Promise<void>}
 */
export const ensureMathEngine = () => {
    if (mathReadyPromise) return mathReadyPromise;
    mathReadyPromise = (async () => {
        if (window.katex && window.renderMathInElement) {
            mathEngine = 'katex';
            return;
        }

        try {
            await loadStyle(KATEX_CSS_URL);
            await loadScript(KATEX_JS_URL);
            await loadScript(KATEX_AUTO_URL);
            if (window.katex && window.renderMathInElement) {
                mathEngine = 'katex';
                return;
            }
        } catch (error) {
            console.warn('[Manager] KaTeX 加载失败，尝试 MathJax:', error);
        }

        if (window.MathJax && window.MathJax.typesetPromise) {
            mathEngine = 'mathjax';
            return;
        }

        try {
            window.MathJax = {
                tex: {
                    inlineMath: [['$', '$'], ['\\(', '\\)']],
                    displayMath: [['$$', '$$'], ['\\[', '\\]']],
                },
                options: {
                    skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
                    ignoreHtmlClass: 'code-block|line-content|katex|no-math',
                },
                startup: { typeset: false },
            };
            await loadScript(MATHJAX_URL);
            if (window.MathJax && window.MathJax.typesetPromise) {
                await window.MathJax.startup.promise;
                mathEngine = 'mathjax';
                return;
            }
        } catch (error) {
            console.warn('[Manager] MathJax 加载失败:', error);
        }

        mathEngine = null;
    })();
    return mathReadyPromise;
};

/**
 * 渲染内容中的数学公式
 * @param {Element} contentEl
 * @returns {Promise<void>}
 */
export const renderMath = async (contentEl) => {
    if (!contentEl || isEditable(contentEl)) return;

    const text = contentEl.textContent || '';
    if (!MATH_HINT_RE.test(text)) return;

    captureRawText(contentEl);

    await ensureMathEngine();

    if (mathEngine === 'katex' && window.renderMathInElement) {
        window.renderMathInElement(contentEl, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '\\[', right: '\\]', display: true },
                { left: '\\(', right: '\\)', display: false },
                { left: '$', right: '$', display: false },
            ],
            ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
            ignoredClasses: ['code-block', 'line-content', 'katex', 'no-math'],
            throwOnError: false,
        });
        contentEl.setAttribute(MATH_ATTR, '1');
        return;
    }

    if (mathEngine === 'mathjax' && window.MathJax?.typesetPromise) {
        await window.MathJax.typesetPromise([contentEl]);
        contentEl.setAttribute(MATH_ATTR, '1');
    }
};
