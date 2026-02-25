/**
 * Load Mermaid on demand for Manager code blocks and render SVG through the Trusted Types policy
 * Keep the source block until the diagram is ready
 */

import {
    MERMAID_ATTR,
    MERMAID_URL,
    MERMAID_SOURCE_PROP,
    MERMAID_CONTAINER_CLASS,
    MERMAID_COPY_BTN_CLASS,
    COPY_BTN_CLASS,
} from './constants.js';
import {
    loadScript,
    createCopyButton,
    copyToClipboard,
    showCopySuccess,
    withTrustedHTML,
} from './utils.js';

let mermaidLoaded = false;
let mermaidLoading = null;
let mermaidId = 0;
const MERMAID_RENDERING_PROP = '__managerMermaidRendering';
const MERMAID_ERROR_PROP = '__managerMermaidErrorSource';
const MERMAID_STABLE_DELAY = 400;
const mermaidDeferred = new WeakMap();

/** Select a Trusted Types policy for Mermaid rendering */
let mermaidPolicy = null;
const ensureMermaidPolicy = () => {
    if (mermaidPolicy) return mermaidPolicy;
    const tt = window.trustedTypes;
    if (!tt?.createPolicy) return null;

    // Prefer managerPanel, the policy name allowed by the Manager CSP
    const policyNames = ['managerPanel', 'dompurifyMermaid', 'mermaid', 'dompurify'];
    for (const name of policyNames) {
        try {
            mermaidPolicy = tt.createPolicy(name, {
                createHTML: (html) => html,
                createScriptURL: (url) => url,
            });
            console.log(`[Manager] 成功创建 Trusted Types policy: ${name}`);
            return mermaidPolicy;
        } catch {
            // Try the next name if the policy already exists or CSP rejects it
        }
    }
    return null;
};

/**
 * Share the pending Mermaid load across renders
 *
 * @returns {Promise<boolean>} True if the library loaded
 */
const ensureMermaid = async () => {
    if (mermaidLoaded) return true;
    if (!mermaidLoading) {
        mermaidLoading = (async () => {
            try {
                ensureMermaidPolicy();

                await loadScript(MERMAID_URL);
                if (window.mermaid) {
                    window.mermaid.initialize({
                        startOnLoad: false,
                        theme: 'dark',
                        securityLevel: 'loose',
                    });
                    mermaidLoaded = true;
                    return true;
                }
                return false;
            } catch (err) {
                console.warn('[Manager] Mermaid 加载失败:', err);
                return false;
            }
        })();
    }

    const loaded = await mermaidLoading;
    if (!loaded) {
        // Clear the failed load so the next render can retry
        mermaidLoading = null;
    }
    return loaded;
};

/**
 * @param {HTMLElement} el - Element to start searching from
 * @returns {HTMLElement|null} Matching code block, or null
 */
const resolveCodeBlock = (el) => {
    if (!el) return null;
    if (el.classList?.contains('code-block')) return el;
    const direct = el.querySelector?.('.code-block');
    if (direct) return direct;
    return el.closest?.('.code-block') || null;
};

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

const isMermaidSource = (source) => {
    const text = (source || '').trim();
    if (!text) return false;
    return /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|journey|gitGraph)/m.test(text);
};

const scheduleMermaidRender = (codeBlock) => {
    if (!codeBlock || !codeBlock.isConnected) return;

    const source = extractMermaidSource(codeBlock);
    if (!isMermaidSource(source)) return;

    const now = Date.now();
    const existing = mermaidDeferred.get(codeBlock);

    if (existing) {
        if (existing.lastSource !== source) {
            existing.lastSource = source;
            existing.lastChange = now;
        }
        return;
    }

    const state = {
        lastSource: source,
        lastChange: now,
        timerId: 0,
    };

    const attempt = () => {
        mermaidDeferred.delete(codeBlock);
        if (!codeBlock || !codeBlock.isConnected) return;

        const currentSource = extractMermaidSource(codeBlock);
        const currentTime = Date.now();

        if (currentSource !== state.lastSource) {
            state.lastSource = currentSource;
            state.lastChange = currentTime;
            state.timerId = window.setTimeout(attempt, MERMAID_STABLE_DELAY);
            mermaidDeferred.set(codeBlock, state);
            return;
        }

        const idleMs = currentTime - state.lastChange;
        if (idleMs < MERMAID_STABLE_DELAY) {
            state.timerId = window.setTimeout(attempt, MERMAID_STABLE_DELAY);
            mermaidDeferred.set(codeBlock, state);
            return;
        }

        if (!isMermaidSource(currentSource)) {
            return;
        }

        void renderMermaid(codeBlock);
    };

    state.timerId = window.setTimeout(attempt, MERMAID_STABLE_DELAY);
    mermaidDeferred.set(codeBlock, state);
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

const resolveHideTarget = (codeBlock) => {
    const wrapper = codeBlock?.parentElement;
    if (wrapper && wrapper.children.length === 1) {
        return wrapper;
    }
    return codeBlock || null;
};

/**
 * @param {HTMLElement} el - Mermaid code block or a descendant
 * @returns {Promise<void>}
 */
export const renderMermaid = async (el) => {
    const codeBlock = resolveCodeBlock(el);
    if (!codeBlock) return;

    const source = extractMermaidSource(codeBlock);
    if (!isMermaidSource(source)) return;

    const previousSource = codeBlock[MERMAID_SOURCE_PROP] || '';
    const isRendered = codeBlock.getAttribute(MERMAID_ATTR) === '1';
    const contentChanged = previousSource && previousSource !== source;
    const errorSource = codeBlock[MERMAID_ERROR_PROP] || '';

    if (isRendered && !contentChanged) return;
    if (!isRendered && !contentChanged && errorSource === source) return;
    if (codeBlock[MERMAID_RENDERING_PROP]) return;

    codeBlock[MERMAID_SOURCE_PROP] = source;
    codeBlock[MERMAID_RENDERING_PROP] = true;

    const loaded = await ensureMermaid();
    if (!loaded || !window.mermaid) {
        delete codeBlock[MERMAID_RENDERING_PROP];
        return;
    }

    let container = null;
    let hideTarget = null;
    let renderId = null;

    try {
        if (typeof window.mermaid.parse === 'function') {
            await window.mermaid.parse(source);
        }

        renderId = `manager-mermaid-${++mermaidId}`;

        hideTarget = resolveHideTarget(codeBlock);
        container = hideTarget?.previousElementSibling;
        if (!container || !container.classList.contains(MERMAID_CONTAINER_CLASS)) {
            container = document.createElement('div');
            container.className = MERMAID_CONTAINER_CLASS;
        } else {
            clearChildren(container);
        }

        // Keep the original code visible while the asynchronous render is pending
        if (hideTarget?.parentNode) {
            if (!container.isConnected) {
                hideTarget.parentNode.insertBefore(container, hideTarget);
            }
        } else if (codeBlock.parentNode && !container.isConnected) {
            codeBlock.parentNode.insertBefore(container, codeBlock);
        }

        const renderResult = await withTrustedHTML(
            () => window.mermaid.render(renderId, source, container),
            mermaidPolicy
        );

        const { svg, bindFunctions } = renderResult;

        const parser = new DOMParser();
        const doc = parser.parseFromString(svg, 'image/svg+xml');
        const svgEl = doc.querySelector('svg');
        if (!svgEl) {
            throw new Error('Mermaid SVG parse failed');
        }

        clearChildren(container);
        const importedSvg = document.importNode(svgEl, true);
        container.appendChild(importedSvg);
        container[MERMAID_SOURCE_PROP] = source;

        const copyBtn = createCopyButton(`${COPY_BTN_CLASS} ${MERMAID_COPY_BTN_CLASS}`);
        copyBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const success = await copyToClipboard(source);
            if (success) showCopySuccess(copyBtn);
        });
        container.appendChild(copyBtn);

        if (typeof bindFunctions === 'function') {
            bindFunctions(container);
        }

        // Swap the code block for the diagram only after rendering succeeds
        container.style.display = '';
        if (hideTarget) {
            hideTarget.style.display = 'none';
        }

        codeBlock.setAttribute(MERMAID_ATTR, '1');
        delete codeBlock[MERMAID_ERROR_PROP];
    } catch (err) {
        console.warn('[Manager] Mermaid 渲染失败:', err);
        codeBlock[MERMAID_ERROR_PROP] = source;
        codeBlock.removeAttribute(MERMAID_ATTR);
        if (hideTarget) hideTarget.style.display = '';
        if (container?.classList?.contains(MERMAID_CONTAINER_CLASS)) {
            container.style.display = 'none';
        }
    } finally {
        if (renderId) {
            cleanupMermaidTemp(renderId);
        }
        delete codeBlock[MERMAID_RENDERING_PROP];
    }
};

/**
 * @param {HTMLElement} root
 * @returns {void}
 */
export const scanMermaid = (root) => {
    if (!root) return;

    const codeBlocks = [];
    if (root.matches?.('.code-block')) {
        codeBlocks.push(root);
    }
    codeBlocks.push(...root.querySelectorAll('.code-block'));
    codeBlocks.forEach((block) => {
        scheduleMermaidRender(block);
    });
};
