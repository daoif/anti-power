/**
 * Manager Panel DOM 扫描与监听
 * 完全独立于 cascade-panel
 */

import { CONTENT_SELECTOR, SECTION_SELECTOR } from './constants.js';
import { ensureContentCopyButton, addFeedbackCopyButtons } from './copy.js';
import { renderMath } from './math.js';
import { scanMermaid } from './mermaid.js';

/**
 * 功能配置
 */
let config = {
    mermaid: false,
    math: false,
    copyButton: true,
};

const STABLE_RENDER_DELAY = 400;
const STABLE_RENDER_MAX_WAIT = 3000;
const deferredRenders = new WeakMap();

/**
 * 检查内容是否已完成输出（通过检测 Good/Bad 按钮）
 * @param {HTMLElement} el
 * @returns {boolean}
 */
const isContentComplete = (el) => {
    let node = el;
    for (let i = 0; i < 15 && node; i++) {
        if (node.querySelector('[data-tooltip-id^="up-"], [data-tooltip-id^="down-"]')) {
            return true;
        }
        node = node.parentElement;
    }
    return false;
};

/**
 * 清除延迟渲染
 * @param {HTMLElement} el
 */
const clearDeferredRender = (el) => {
    const state = deferredRenders.get(el);
    if (state) {
        clearTimeout(state.timerId);
        deferredRenders.delete(el);
    }
};

/**
 * 延迟渲染调度
 * @param {HTMLElement} el
 */
const scheduleDeferredRender = (el) => {
    if (!el || !el.isConnected) return;

    const text = el.textContent || '';
    const now = Date.now();
    const existing = deferredRenders.get(el);

    if (existing) {
        if (existing.lastText !== text) {
            existing.lastText = text;
            existing.lastChange = now;
        }
        return;
    }

    const state = {
        lastText: text,
        lastChange: now,
        startTime: now,
        timerId: 0,
    };

    const attempt = () => {
        deferredRenders.delete(el);
        if (!el || !el.isConnected) return;

        const currentText = el.textContent || '';
        const currentTime = Date.now();

        if (currentText !== state.lastText) {
            state.lastText = currentText;
            state.lastChange = currentTime;
            state.timerId = window.setTimeout(attempt, STABLE_RENDER_DELAY);
            deferredRenders.set(el, state);
            return;
        }

        const idleMs = currentTime - state.lastChange;
        const totalMs = currentTime - state.startTime;
        const complete = isContentComplete(el);

        if (complete || idleMs >= STABLE_RENDER_DELAY || totalMs >= STABLE_RENDER_MAX_WAIT) {
            renderContentNode(el, true);
            return;
        }

        state.timerId = window.setTimeout(attempt, STABLE_RENDER_DELAY);
        deferredRenders.set(el, state);
    };

    state.timerId = window.setTimeout(attempt, STABLE_RENDER_DELAY);
    deferredRenders.set(el, state);
};

/**
 * 渲染单个内容区
 * @param {HTMLElement} el
 * @param {boolean} force
 */
const renderContentNode = (el, force = false) => {
    if (!el || !el.isConnected) return;

    if (config.copyButton) {
        ensureContentCopyButton(el);
    }

    const ready = force || isContentComplete(el);
    if (!ready) {
        scheduleDeferredRender(el);
        return;
    }

    clearDeferredRender(el);

    if (config.math) {
        void renderMath(el);
    }

    if (config.mermaid) {
        scanMermaid(el);
    }
};

/**
 * 扫描根节点
 * @param {HTMLElement} root
 */
const scan = (root) => {
    if (!root || !root.isConnected) return;

    // 查找内容区
    const contentNodes = [];
    if (root.matches?.(CONTENT_SELECTOR)) {
        contentNodes.push(root);
    }
    contentNodes.push(...root.querySelectorAll(CONTENT_SELECTOR));

    contentNodes.forEach((node) => renderContentNode(node));

    // 额外扫描 section 区域内的 Mermaid
    if (config.mermaid) {
        const sections = root.querySelectorAll(SECTION_SELECTOR);
        sections.forEach((section) => scanMermaid(section));
    }
};

/**
 * 获取渲染根节点
 * @returns {HTMLElement}
 */
const getRoot = () => document.body;

let pendingNodes = new Set();
let scheduled = false;

/**
 * 批量处理待扫描节点
 */
const flushScan = () => {
    scheduled = false;
    const nodes = [...pendingNodes];
    pendingNodes.clear();

    nodes.forEach((node) => {
        if (node.isConnected) scan(node);
    });

    if (config.copyButton) {
        addFeedbackCopyButtons();
    }
};

/**
 * 解析扫描根节点
 * @param {Node} target
 * @returns {HTMLElement|null}
 */
const resolveScanRoot = (target) => {
    if (!target) return null;
    if (target.nodeType === Node.TEXT_NODE) {
        target = target.parentElement;
    }
    if (target?.closest) {
        const contentRoot = target.closest(CONTENT_SELECTOR);
        if (contentRoot) return contentRoot;

        const sectionRoot = target.closest(SECTION_SELECTOR);
        if (sectionRoot) return sectionRoot;
    }
    return target;
};

/**
 * 调度扫描任务
 * @param {NodeList|Array} nodes
 */
const scheduleScan = (nodes) => {
    let hasElements = false;

    nodes.forEach((node) => {
        const scanRoot = resolveScanRoot(node);
        if (scanRoot) {
            pendingNodes.add(scanRoot);
            hasElements = true;
        }
    });

    if (hasElements && !scheduled) {
        scheduled = true;
        requestAnimationFrame(flushScan);
    }
};

/**
 * 初始化
 */
const init = () => {
    const root = getRoot();
    scan(root);

    if (config.copyButton) {
        addFeedbackCopyButtons();
    }

    const observer = new MutationObserver((mutations) => {
        const nodesToScan = [];
        mutations.forEach((mutation) => {
            if (mutation.type === 'characterData' && mutation.target.parentElement) {
                nodesToScan.push(mutation.target.parentElement);
                return;
            }
            if (mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach((node) => nodesToScan.push(node));
            }
        });
        if (nodesToScan.length > 0) {
            scheduleScan(nodesToScan);
        }
    });

    observer.observe(root, { childList: true, subtree: true, characterData: true });
    console.log('[Manager Panel] 扫描模块已启动');
};

/**
 * 模块入口
 * @param {Object} userConfig
 */
export const start = (userConfig = {}) => {
    config = { ...config, ...userConfig };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
};
