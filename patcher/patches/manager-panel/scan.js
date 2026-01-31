/**
 * Manager Panel DOM 扫描与监听
 *
 * 本模块是 Manager 补丁的核心调度器，完全独立于 cascade-panel。
 *
 * 主要职责：
 * - 扫描 DOM 中的内容区域并触发渲染
 * - 监听 DOM 变更以处理新增内容
 * - 管理延迟渲染队列，等待内容稳定后再处理
 *
 * 扫描策略：
 * - 使用 MutationObserver 监听 DOM 变更
 * - 通过 Good/Bad 按钮判断消息是否完成输出
 * - 延迟渲染避免流式输出时频繁触发
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

        // 只有在以下情况才渲染：
        // 1. 有 feedback 按钮（内容输出完成）
        // 2. 或内容稳定超过最大等待时间（2.5秒）
        // 注意：不再因为短暂的 400ms 稳定就触发，避免在 AI 输出间隙时误触发
        if (complete) {
            console.log('[Manager DEBUG] deferred render: complete, rendering');
            renderContentNode(el, true);
            return;
        }

        if (totalMs >= STABLE_RENDER_MAX_WAIT && idleMs >= STABLE_RENDER_DELAY) {
            console.log('[Manager DEBUG] deferred render: max wait reached and stable, rendering');
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
    console.log('[Manager DEBUG] renderContentNode called', { el: el?.className, force, isConnected: el?.isConnected });
    if (!el || !el.isConnected) return;

    if (config.mermaid) {
        console.log('[Manager DEBUG] calling scanMermaid', { configMermaid: config.mermaid });
        scanMermaid(el);
    } else {
        console.log('[Manager DEBUG] config.mermaid is false, skipping scanMermaid');
    }

    if (config.copyButton) {
        ensureContentCopyButton(el);
    }

    const ready = force || isContentComplete(el);
    console.log('[Manager DEBUG] ready check', { ready, force, isComplete: isContentComplete(el) });
    if (!ready) {
        scheduleDeferredRender(el);
        return;
    }

    clearDeferredRender(el);

    if (config.math) {
        console.log('[Manager DEBUG] calling renderMath');
        void renderMath(el);
    }
};

/**
 * 扫描根节点
 * @param {HTMLElement} root
 */
const scan = (root) => {
    console.log('[Manager DEBUG] scan called', { rootTag: root?.tagName, isConnected: root?.isConnected });
    if (!root || !root.isConnected) return;

    // 查找内容区
    const contentNodes = [];
    if (root.matches?.(CONTENT_SELECTOR)) {
        contentNodes.push(root);
    }
    contentNodes.push(...root.querySelectorAll(CONTENT_SELECTOR));
    console.log('[Manager DEBUG] contentNodes found', { count: contentNodes.length, selector: CONTENT_SELECTOR });

    contentNodes.forEach((node) => renderContentNode(node));

    if (config.mermaid) {
        scanMermaid(root);
    }

    if (config.copyButton) {
        addFeedbackCopyButtons();
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
