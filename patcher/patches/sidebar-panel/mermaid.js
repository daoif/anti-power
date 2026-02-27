/**
 * Sidebar Panel Mermaid 图表渲染
 *
 * 本模块负责 Sidebar 面板的 Mermaid 图表渲染，完全独立于 cascade-panel。
 *
 * 渲染流程：
 * 1. 扫描代码块并检测 Mermaid 语法
 * 2. 按需加载 Mermaid 库（CDN）
 * 3. 使用 Trusted Types 安全渲染 SVG
 * 4. 原代码块隐藏，渲染结果插入其前
 *
 * 特殊处理：
 * - 使用 withTrustedHTML 绕过 Trusted Types 限制
 * - 支持延迟渲染，等待内容稳定后再处理
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
const MERMAID_RENDERING_PROP = '__sidebarMermaidRendering';
const MERMAID_ERROR_PROP = '__sidebarMermaidErrorSource';
const MERMAID_STABLE_DELAY = 400;
const mermaidDeferred = new WeakMap();

/**
 * 尝试创建 Mermaid 专用的 Trusted Types policy
 */
let mermaidPolicy = null;
const ensureMermaidPolicy = () => {
    if (mermaidPolicy) return mermaidPolicy;
    const tt = window.trustedTypes;
    if (!tt?.createPolicy) return null;

    // 尝试使用 CSP 中允许的 policy 名称（sidebarPanel 是我们专门添加的）
    const policyNames = ['sidebarPanel', 'dompurifyMermaid', 'mermaid', 'dompurify'];
    for (const name of policyNames) {
        try {
            mermaidPolicy = tt.createPolicy(name, {
                createHTML: (html) => html,
                createScriptURL: (url) => url,
            });
            console.log(`[Sidebar] 成功创建 Trusted Types policy: ${name}`);
            return mermaidPolicy;
        } catch {
            // 该名称可能已被使用或不允许，尝试下一个
        }
    }
    return null;
};

/**
 * 加载 Mermaid 库
 *
 * 使用 Promise 缓存避免重复加载。
 *
 * @returns {Promise<boolean>} true 表示加载成功
 */
const ensureMermaid = async () => {
    if (mermaidLoaded) return true;
    if (!mermaidLoading) {
        mermaidLoading = (async () => {
            try {
                // 在加载 Mermaid 前尝试创建 Trusted Types policy
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
                console.warn('[Sidebar] Mermaid 加载失败:', err);
                return false;
            }
        })();
    }

    const loaded = await mermaidLoading;
    if (!loaded) {
        // 失败不缓存，允许后续渲染触发时重试
        mermaidLoading = null;
    }
    return loaded;
};

/**
 * 查找 Mermaid 代码块容器
 *
 * @param {HTMLElement} el - 起始元素
 * @returns {HTMLElement|null} 代码块元素或 null
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
 * 渲染 Mermaid 图表
 *
 * 检测 Mermaid 语法并渲染为 SVG 图表。
 *
 * @param {HTMLElement} el - 包含 Mermaid 代码的 code-block 或其子元素
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

        renderId = `sidebar-mermaid-${++mermaidId}`;

        hideTarget = resolveHideTarget(codeBlock);
        container = hideTarget?.previousElementSibling;
        if (!container || !container.classList.contains(MERMAID_CONTAINER_CLASS)) {
            container = document.createElement('div');
            container.className = MERMAID_CONTAINER_CLASS;
        } else {
            clearChildren(container);
        }

        // 注意：这里只插入容器，不隐藏代码块
        // 代码块的隐藏放在渲染成功后，避免异步等待期间的不一致状态
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

        clearChildren(container);
        await withTrustedHTML(() => {
            container.innerHTML = svg;
        }, mermaidPolicy);
        const svgEl = container.querySelector('svg');
        if (!svgEl) {
            throw new Error('Mermaid SVG parse failed');
        }
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

        // 渲染成功后才隐藏代码块并显示容器（与侧边栏实现对齐）
        container.style.display = '';
        if (hideTarget) {
            hideTarget.style.display = 'none';
        }

        codeBlock.setAttribute(MERMAID_ATTR, '1');
        delete codeBlock[MERMAID_ERROR_PROP];
    } catch (err) {
        console.warn('[Sidebar] Mermaid 渲染失败:', err);
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
 * 扫描指定区域内所有可能的 Mermaid 代码块
 *
 * @param {HTMLElement} root - 要扫描的根节点
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
