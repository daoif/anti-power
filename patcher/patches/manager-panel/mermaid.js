/**
 * Manager Panel Mermaid 图表渲染
 * 完全独立于 cascade-panel
 */

import {
    MERMAID_ATTR,
    MERMAID_CONTAINER_CLASS,
    MERMAID_COPY_BTN_CLASS,
    MERMAID_SOURCE_PROP,
    MERMAID_URL,
    COPY_BTN_CLASS,
} from './constants.js';
import {
    createCopyButton,
    copyToClipboard,
    loadScript,
    showCopySuccess,
    withTrustedHTML,
} from './utils.js';

let mermaidReady = false;
let mermaidReadyPromise = null;
let mermaidIdCounter = 0;
const MERMAID_RENDERING_PROP = '__managerMermaidRendering';
const MERMAID_ERROR_PROP = '__managerMermaidErrorSource';
const MERMAID_MARKER_SELECTOR =
    '[class*="language-mermaid"], [data-language="mermaid"], [data-lang="mermaid"], [data-mode="mermaid"], [data-code-language="mermaid"]';

/**
 * 初始化 Mermaid 配置
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
            console.warn('[Manager] Mermaid 加载失败:', error);
            mermaidReady = false;
        }
    })();
    return mermaidReadyPromise;
};

const getClassString = (el) => {
    const className = el?.className || '';
    if (typeof className === 'string') return className;
    if (className && typeof className.baseVal === 'string') return className.baseVal;
    return '';
};

const normalizeLang = (value) => {
    if (!value) return '';
    return String(value).trim().toLowerCase();
};

const resolveLangAttr = (el) => {
    if (!el?.getAttribute) return '';
    const raw =
        el.getAttribute('data-language') ||
        el.getAttribute('data-lang') ||
        el.getAttribute('data-mode') ||
        el.getAttribute('data-code-language');
    return normalizeLang(raw);
};

const resolveMermaidRoot = (el) => {
    if (!el) return null;
    if (el.matches?.(MERMAID_MARKER_SELECTOR)) return el;
    return el.closest?.(MERMAID_MARKER_SELECTOR) || el;
};

const resolveCodeBlock = (el) => {
    if (!el) return null;
    if (el.classList?.contains('code-block')) return el;
    return el.querySelector?.('.code-block') || null;
};

const isMermaidCandidate = (root, codeBlock) => {
    const rootClass = getClassString(root);
    const blockClass = getClassString(codeBlock);
    if (rootClass.includes('language-mermaid') || blockClass.includes('language-mermaid')) {
        return true;
    }
    const lang = resolveLangAttr(root) || resolveLangAttr(codeBlock);
    return lang === 'mermaid';
};

/**
 * 提取 Mermaid 源码
 * @param {Element} codeBlock
 * @returns {string}
 */
const extractMermaidSource = (codeBlock) => {
    if (!codeBlock) return '';
    const lines = codeBlock.querySelectorAll('.line-content');
    if (lines.length > 0) {
        let source = '';
        lines.forEach((line, idx) => {
            source += line.textContent || '';
            if (idx < lines.length - 1) source += '\n';
        });
        return source.trim();
    }
    return (codeBlock.textContent || '').trim();
};

const clearChildren = (el) => {
    while (el.firstChild) {
        el.removeChild(el.firstChild);
    }
};

const cleanupMermaidTemp = (id) => {
    const temp = document.getElementById(`d${id}`);
    if (temp) temp.remove();
};

/**
 * 原地渲染 Mermaid 图表
 * @param {Element} codeBlockContainer
 * @returns {Promise<void>}
 */
export const renderMermaid = async (codeBlockContainer) => {
    const root = resolveMermaidRoot(codeBlockContainer);
    const codeBlock = resolveCodeBlock(root) || resolveCodeBlock(codeBlockContainer);
    if (!root || !codeBlock) return;

    const source = extractMermaidSource(codeBlock);
    if (!source) return;
    if (!isMermaidCandidate(root, codeBlock)) return;

    const previousSource = root[MERMAID_SOURCE_PROP] || '';
    const isRendered = root.getAttribute(MERMAID_ATTR) === '1';
    const contentChanged = previousSource && previousSource !== source;
    const errorSource = root[MERMAID_ERROR_PROP] || '';

    if (isRendered && !contentChanged) return;
    if (!isRendered && !contentChanged && errorSource === source) return;
    if (root[MERMAID_RENDERING_PROP]) return;

    root[MERMAID_SOURCE_PROP] = source;
    root[MERMAID_RENDERING_PROP] = true;

    let renderId = null;

    try {
        await ensureMermaid();
        if (!mermaidReady || !window.mermaid) {
            console.warn('[Manager] Mermaid 引擎未就绪');
            return;
        }

        if (typeof window.mermaid.parse === 'function') {
            await window.mermaid.parse(source);
        }

        renderId = `manager-mermaid-${++mermaidIdCounter}`;

        let container = root.nextElementSibling;
        let copyBtn = null;
        const hasContainer = container && container.classList.contains(MERMAID_CONTAINER_CLASS);
        if (!hasContainer) {
            container = document.createElement('div');
            container.className = MERMAID_CONTAINER_CLASS;
            root.insertAdjacentElement('afterend', container);
        }

        const { svg, bindFunctions } = await withTrustedHTML(() =>
            window.mermaid.render(renderId, source, container)
        );

        copyBtn = container.querySelector(`.${MERMAID_COPY_BTN_CLASS}`);
        if (!copyBtn) {
            copyBtn = createCopyButton(`${COPY_BTN_CLASS} ${MERMAID_COPY_BTN_CLASS}`);
            copyBtn.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();
                const mermaidSource = root[MERMAID_SOURCE_PROP] || '';
                if (!mermaidSource) return;
                const text = `\`\`\`mermaid\n${mermaidSource}\n\`\`\``;
                const success = await copyToClipboard(text);
                if (success) showCopySuccess(copyBtn);
            });
        }

        clearChildren(container);
        const parser = new DOMParser();
        const doc = parser.parseFromString(svg, 'image/svg+xml');
        const svgEl = doc.querySelector('svg');
        if (!svgEl) {
            throw new Error('Mermaid SVG parse failed');
        }
        container.appendChild(document.importNode(svgEl, true));

        container.style.display = '';
        container[MERMAID_SOURCE_PROP] = source;
        if (copyBtn) {
            container.appendChild(copyBtn);
        }
        if (typeof bindFunctions === 'function') {
            bindFunctions(container);
        }

        root.style.display = 'none';
        root.setAttribute(MERMAID_ATTR, '1');
        delete root[MERMAID_ERROR_PROP];
    } catch (error) {
        console.warn('[Manager] Mermaid 渲染失败:', error);
        root[MERMAID_ERROR_PROP] = source;
        root.removeAttribute(MERMAID_ATTR);
        root.style.display = '';
        const container = root.nextElementSibling;
        if (container && container.classList.contains(MERMAID_CONTAINER_CLASS)) {
            container.innerHTML = '';
            container.style.display = 'none';
        }
    } finally {
        if (renderId) {
            cleanupMermaidTemp(renderId);
        }
        delete root[MERMAID_RENDERING_PROP];
    }
};

/**
 * 扫描指定区域内所有可能的 Mermaid 代码块
 * @param {HTMLElement} root
 */
export const scanMermaid = (root) => {
    if (!root) return;

    const codeBlocks = [];
    if (root.matches?.('.code-block')) {
        codeBlocks.push(root);
    }
    codeBlocks.push(...root.querySelectorAll('.code-block'));
    codeBlocks.forEach((block) => {
        void renderMermaid(block);
    });
};
