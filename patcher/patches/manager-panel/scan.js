/**
 * Manager DOM scan scheduler
 *
 * Runs independently of the legacy Cascade Panel
 *
 * Responsibilities
 * - Dispatch enabled enhancements for matching content
 * - Pick up newly added content after DOM changes
 *
 * Observation
 * - Watch for changes with MutationObserver
 */

import { CONTENT_SELECTOR, SECTION_SELECTOR } from './constants.js';
import { ensureContentCopyButton, addFeedbackCopyButtons } from './copy.js';
import { renderMath } from './math.js';
import { scanMermaid } from './mermaid.js';

let config = {
    mermaid: false,
    math: false,
    copyButton: true,
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

/** @returns {HTMLElement} Document body */
const getRoot = () => document.body;

let pendingNodes = new Set();
let scheduled = false;

const flushScan = () => {
    scheduled = false;
    const nodes = [...pendingNodes];
    pendingNodes.clear();

    nodes.forEach((node) => {
        if (node.isConnected) scanClassic(node);
    });

};

/**
 * Use the nearest content container or section for a mutation target
 *
 * @param {Node} target - Mutation target
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

const init = () => {
    const root = getRoot();
    scanClassic(root);

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

    // Poll for new feedback rows so their copy buttons remain available
    if (config.copyButton) {
        const scanFeedback = () => {
            addFeedbackCopyButtons();
        };
        scanFeedback();
        setInterval(scanFeedback, 2000);
    }

    console.log('[Manager Panel] 扫描模块已启动');
};

/**
 * @param {Object} [userConfig={}] - Feature overrides
 * @returns {void}
 */
export const start = (userConfig = {}) => {
    config = { ...config, ...userConfig };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
};
