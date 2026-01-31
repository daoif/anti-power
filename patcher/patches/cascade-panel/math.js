/**
 * Prefer KaTeX and fall back to MathJax
 * Support inline $...$ and \(...\), and display $$...$$ and \[...\]
 * Share the pending engine load across renders
 */

import {
    KATEX_AUTO_URL,
    KATEX_CSS_URL,
    KATEX_JS_URL,
    MATH_ATTR,
    MATH_HINT_RE,
    MATHJAX_URL,
} from './constants.js';
import { captureRawText, isEditable, loadScript, loadStyle } from './utils.js';

let mathEngine = null;
let mathReadyPromise = null;

/**
 * Share one engine load across renders and fall back to MathJax if KaTeX fails
 *
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
            console.warn('[Cascade] KaTeX 加载失败，尝试 MathJax:', error);
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
            console.warn('[Cascade] MathJax 加载失败:', error);
        }

        mathEngine = null;
    })();
    return mathReadyPromise;
};

/**
 * Skip editable content and content without math delimiters
 *
 * @param {Element} contentEl
 * @returns {Promise<void>}
 */
export const renderMath = async (contentEl) => {
    if (!contentEl || isEditable(contentEl)) return;

    captureRawText(contentEl);
    const text = contentEl.textContent || '';
    if (!MATH_HINT_RE.test(text)) return;

    await ensureMathEngine();

    // Keep formula-like text literal inside code and preformatted elements
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
