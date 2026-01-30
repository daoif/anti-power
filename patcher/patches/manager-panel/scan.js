/**
 * Observe Manager content independently of the legacy Cascade Panel
 * Wait for Good/Bad feedback controls or stable content before rendering streamed messages
 */

import { CONTENT_SELECTOR, SECTION_SELECTOR } from './constants.js';
import { ensureContentCopyButton } from './copy.js';
import { renderMath } from './math.js';
import { scanMermaid } from './mermaid.js';

let config = {
    mermaid: false,
    math: false,
    copyButton: true,
};

const STABLE_RENDER_DELAY = 400;
const STABLE_RENDER_MAX_WAIT = 3000;
const deferredRenders = new WeakMap();

/**
 * Use Good/Bad feedback controls to detect the end of a streamed message
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

/** @param {HTMLElement} el */
const clearDeferredRender = (el) => {
    const state = deferredRenders.get(el);
    if (state) {
        clearTimeout(state.timerId);
        deferredRenders.delete(el);
    }
};

/** @param {HTMLElement} el */
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

        // Render immediately when feedback controls signal that the message is complete
        // Otherwise wait at least 2.5 seconds and require the text to settle
        // A brief 400 ms gap alone can occur while the message is still streaming
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

/** @param {HTMLElement} root */
const scan = (root) => {
    console.log('[Manager DEBUG] scan called', { rootTag: root?.tagName, isConnected: root?.isConnected });
    if (!root || !root.isConnected) return;

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
};

/** @returns {HTMLElement} */
const getRoot = () => document.body;

let pendingNodes = new Set();
let scheduled = false;

const flushScan = () => {
    scheduled = false;
    const nodes = [...pendingNodes];
    pendingNodes.clear();

    nodes.forEach((node) => {
        if (node.isConnected) scan(node);
    });

};

/**
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

/** @param {NodeList|Array} nodes */
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

/** @param {Object} userConfig */
export const start = (userConfig = {}) => {
    config = { ...config, ...userConfig };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
};
