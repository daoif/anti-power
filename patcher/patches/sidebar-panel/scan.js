/** Observe the modern Sidebar DOM and dispatch enhancements independently of the legacy Cascade Panel */

import {
    PANEL_SELECTOR,
    CONTENT_SELECTOR,
    SECTION_SELECTOR,
} from './constants.js';
import { ensureContentCopyButton, addFeedbackCopyButtons } from './copy.js';
import { renderMath } from './math.js';
import { scanMermaid } from './mermaid.js';

let config = {
    mermaid: true,
    math: true,
    copyButton: true,
};

let activeRoot = null;
let activeObserver = null;
let feedbackTimer = null;
let rootCheckTimer = null;
let pendingNodes = new Set();
let scheduled = false;

const cleanupActiveWatchers = () => {
    if (activeObserver) {
        activeObserver.disconnect();
        activeObserver = null;
    }

    if (feedbackTimer) {
        clearInterval(feedbackTimer);
        feedbackTimer = null;
    }

    pendingNodes.clear();
    scheduled = false;
};

/**
 * Render matching content nodes beneath the scan root
 *
 * @param {HTMLElement} root
 * @returns {void}
 */
const scanClassic = (root) => {
    if (!root || !root.isConnected) return;

    const contentNodes = [];
    if (root.matches?.(CONTENT_SELECTOR)) {
        contentNodes.push(root);
    }
    contentNodes.push(...root.querySelectorAll(CONTENT_SELECTOR));

    contentNodes.forEach((node) => {
        if (config.copyButton) {
            ensureContentCopyButton(node);
        }
        if (config.math) {
            void renderMath(node);
        }
    });

    if (config.mermaid) {
        scanMermaid(root);
    }
};

/**
 * Use the nearest content container or section for a mutation target
 *
 * @param {Node} target - Mutation target
 * @returns {HTMLElement|null}
 */
const resolveScanRoot = (target) => {
    if (!activeRoot || !target) return null;

    let current = target;
    if (current.nodeType === Node.TEXT_NODE) {
        current = current.parentElement;
    }
    if (!current || !current.closest || !current.closest(PANEL_SELECTOR)) {
        return null;
    }

    const contentRoot = current.closest(CONTENT_SELECTOR);
    if (contentRoot) return contentRoot;

    const sectionRoot = current.closest(SECTION_SELECTOR);
    if (sectionRoot) return sectionRoot;

    return activeRoot;
};

const flushScan = () => {
    scheduled = false;
    const nodes = [...pendingNodes];
    pendingNodes.clear();

    nodes.forEach((node) => {
        if (node.isConnected) scanClassic(node);
    });
};

/**
 * Batch scan requests into the next animation frame
 *
 * @param {NodeList|Array} nodes
 * @returns {void}
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

/** @param {HTMLElement} root - Mounted sidebar root */
const bindRoot = (root) => {
    if (!root || root === activeRoot) return;

    cleanupActiveWatchers();
    activeRoot = root;

    scanClassic(root);

    activeObserver = new MutationObserver((mutations) => {
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

    activeObserver.observe(root, {
        childList: true,
        subtree: true,
        characterData: true,
    });

    if (config.copyButton) {
        const scanFeedback = () => {
            addFeedbackCopyButtons(root);
        };

        scanFeedback();
        feedbackTimer = setInterval(scanFeedback, 2000);
    }

    console.log('[Sidebar Panel] 扫描模块已绑定侧边栏根节点');
};

const init = () => {
    const tryBind = () => {
        const root = document.querySelector(PANEL_SELECTOR);
        if (root) {
            bindRoot(root);
            return true;
        }
        return false;
    };

    if (!tryBind()) {
        console.log('[Sidebar Panel] 等待侧边栏容器挂载...');
    }

    // Poll for a replacement sidebar root after Antigravity remounts it
    rootCheckTimer = setInterval(() => {
        tryBind();
    }, 1500);
};

/**
 * @param {Object} [userConfig={}] - Feature overrides
 * @returns {void}
 */
export const start = (userConfig = {}) => {
    config = { ...config, ...userConfig };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
};
