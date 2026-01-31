/**
 * Cascade Panel 数学公式渲染模块
 *
 * 本模块负责检测并渲染数学公式（LaTeX 语法）。
 *
 * 渲染引擎优先级：
 * 1. KaTeX（首选）：加载速度快，渲染质量高
 * 2. MathJax（回退）：兼容性更广，功能更全
 *
 * 支持的公式语法：
 * - 行内公式：$...$ 或 \(...\)
 * - 块级公式：$$...$$ 或 \[...\]
 *
 * 使用 Promise 缓存机制避免重复加载渲染引擎。
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
 * 确保数学渲染引擎可用，优先 KaTeX，失败后回退 MathJax
 * @returns {Promise<void>}
 * 说明：使用 Promise 缓存避免重复加载（性能优化）
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
 * 渲染内容中的数学公式
 * @param {Element} contentEl
 * @returns {Promise<void>}
 * 边界：可编辑区域直接跳过；无数学提示时快速返回以降低开销
 */
export const renderMath = async (contentEl) => {
    if (!contentEl || isEditable(contentEl)) return;

    captureRawText(contentEl);
    const text = contentEl.textContent || '';
    if (!MATH_HINT_RE.test(text)) return;

    await ensureMathEngine();

    // KaTeX 渲染：基于 auto-render，忽略代码块与预格式化内容
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
