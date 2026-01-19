import {
    MERMAID_ATTR,
    MERMAID_CONTAINER_CLASS,
    MERMAID_COPY_BTN_CLASS,
    MERMAID_SOURCE_PROP,
    MERMAID_URL,
} from './constants.js';
import { bindCopyButton, createCopyButton } from './copy.js';
import { getClassString, loadScript } from './utils.js';

let mermaidReady = false;
let mermaidReadyPromise = null;
let mermaidIdCounter = 0;
const MERMAID_RENDERING_PROP = '__cascadeMermaidRendering';
const MERMAID_ERROR_PROP = '__cascadeMermaidErrorSource';

/**
 * 初始化 Mermaid 配置（主题、字体等）
 * @returns {void}
 */
const initializeMermaid = () => {
    window.mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
            darkMode: true,
            background: '#1e1e1e',
            primaryColor: '#4a9eff',
            primaryTextColor: '#e0e0e0',
            primaryBorderColor: '#4a9eff',
            lineColor: '#6a9eff',
            secondaryColor: '#2d4a6f',
            tertiaryColor: '#1e3a5f',
        },
        securityLevel: 'strict',
        fontFamily: 'var(--vscode-font-family, "Segoe UI", sans-serif)',
    });
    mermaidReady = true;
};

/**
 * 确保 Mermaid 库加载并初始化
 * @returns {Promise<void>}
 * 说明：使用 Promise 缓存避免重复加载（性能优化）
 */
export const ensureMermaid = () => {
    if (mermaidReadyPromise) return mermaidReadyPromise;
    mermaidReadyPromise = (async () => {
        if (window.mermaid && mermaidReady) return;

        if (window.mermaid) {
            initializeMermaid();
            return;
        }

        try {
            await loadScript(MERMAID_URL);
            if (window.mermaid) {
                initializeMermaid();
            }
        } catch (error) {
            console.warn('[Cascade] Mermaid 加载失败:', error);
            mermaidReady = false;
        }
    })();
    return mermaidReadyPromise;
};

/**
 * 提取 Mermaid 源码
 * @param {Element} codeBlockContainer
 * @returns {string}
 */
const extractMermaidSource = (codeBlockContainer) => {
    const codeBlock = codeBlockContainer.querySelector('.code-block');
    if (!codeBlock) return '';

    const lines = codeBlock.querySelectorAll('.line-content');
    let source = '';
    lines.forEach((line, idx) => {
        source += line.textContent;
        if (idx < lines.length - 1) source += '\n';
    });
    return source.trim();
};

/**
 * 原地渲染 Mermaid 图表（保留原代码块并插入渲染容器）
 * @param {Element} codeBlockContainer
 * @returns {Promise<void>}
 */
export const renderMermaid = async (codeBlockContainer) => {
    const classString = getClassString(codeBlockContainer);
    if (!classString.includes('language-mermaid')) return;

    const source = extractMermaidSource(codeBlockContainer);
    if (!source) return;

    const previousSource = codeBlockContainer[MERMAID_SOURCE_PROP] || '';
    const isRendered = codeBlockContainer.getAttribute(MERMAID_ATTR) === '1';
    const contentChanged = previousSource && previousSource !== source;
    const errorSource = codeBlockContainer[MERMAID_ERROR_PROP] || '';

    if (isRendered && !contentChanged) {
        return;
    }

    if (!isRendered && !contentChanged && errorSource === source) {
        return;
    }

    if (codeBlockContainer[MERMAID_RENDERING_PROP]) {
        return;
    }

    codeBlockContainer[MERMAID_SOURCE_PROP] = source;
    codeBlockContainer[MERMAID_RENDERING_PROP] = true;

    try {
        await ensureMermaid();
        if (!mermaidReady || !window.mermaid) {
            console.warn('[Cascade] Mermaid 引擎未就绪');
            return;
        }

        if (typeof window.mermaid.parse === 'function') {
            await window.mermaid.parse(source);
        }

        const id = `cascade-mermaid-${++mermaidIdCounter}`;

        let container = codeBlockContainer.nextElementSibling;
        let copyBtn = null;
        const hasContainer = container && container.classList.contains(MERMAID_CONTAINER_CLASS);
        if (!hasContainer) {
            container = document.createElement('div');
            container.className = MERMAID_CONTAINER_CLASS;
            codeBlockContainer.insertAdjacentElement('afterend', container);
        }

        const { svg, bindFunctions } = await window.mermaid.render(id, source, container);

        copyBtn = container.querySelector(`.${MERMAID_COPY_BTN_CLASS}`);
        if (!copyBtn) {
            copyBtn = createCopyButton({ className: MERMAID_COPY_BTN_CLASS });
            bindCopyButton(copyBtn, {
                getText: () => {
                    const mermaidSource = codeBlockContainer[MERMAID_SOURCE_PROP] || '';
                    if (!mermaidSource) return '';
                    return `\`\`\`mermaid\n${mermaidSource}\n\`\`\``;
                },
                copiedDuration: 1200,
                preventDefault: true,
                stopPropagation: true,
            });
        }

        container.innerHTML = svg;
        container.style.display = '';
        container[MERMAID_SOURCE_PROP] = source;
        if (copyBtn) {
            container.appendChild(copyBtn);
        }
        if (typeof bindFunctions === 'function') {
            bindFunctions(container);
        }

        codeBlockContainer.style.display = 'none';
        codeBlockContainer.setAttribute(MERMAID_ATTR, '1');
        delete codeBlockContainer[MERMAID_ERROR_PROP];
    } catch (error) {
        console.warn('[Cascade] Mermaid 渲染失败:', error);
        codeBlockContainer[MERMAID_ERROR_PROP] = source;
        codeBlockContainer.removeAttribute(MERMAID_ATTR);
        codeBlockContainer.style.display = '';
        const container = codeBlockContainer.nextElementSibling;
        if (container && container.classList.contains(MERMAID_CONTAINER_CLASS)) {
            container.innerHTML = '';
            container.style.display = 'none';
        }
    } finally {
        delete codeBlockContainer[MERMAID_RENDERING_PROP];
    }
};
