/** Observe content mutations and dispatch enabled enhancements */

import { CONTENT_SELECTOR } from './constants.js';
import {
    ensureContentCopyButton,
    addFeedbackCopyButtons,
    bindMathSelectionCopyHandler,
} from './copy.js';
import { renderMath } from './math.js';
import { renderMermaid } from './mermaid.js';

/** The patch entry point supplies feature overrides */
let config = {
    mermaid: true,
    math: true,
    copyButton: true,
    tableColor: true,
    fontSizeEnabled: true,
    fontSize: 16,
};

/**
 * Prefer chat, then react-app, then body as the render root
 *
 * @returns {Element}
 */
const getRoot = () =>
    document.getElementById('chat') ||
    document.getElementById('react-app') ||
    document.body;

/**
 * @param {Element} root
 * @returns {void}
 */
const scanClassic = (root) => {
    if (!root || !root.isConnected) return;

    // Include the root because the mutated node can itself be a content region
    const contentNodes = [];
    if (root.matches && root.matches(CONTENT_SELECTOR)) {
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
        const mermaidNodes = [];
        if (root.matches && root.matches('[class*="language-mermaid"]')) {
            mermaidNodes.push(root);
        }
        mermaidNodes.push(...root.querySelectorAll('[class*="language-mermaid"]'));

        mermaidNodes.forEach((node) => {
            void renderMermaid(node);
        });
    }
};

let pendingNodesClassic = new Set();
let scheduledClassic = false;

/**
 * Flush all queued scans on the next animation frame
 *
 * @returns {void}
 */
const flushScanClassic = () => {
    scheduledClassic = false;
    const nodes = [...pendingNodesClassic];
    pendingNodesClassic.clear();

    nodes.forEach((node) => {
        if (node.isConnected) scanClassic(node);
    });

    if (config.copyButton) {
        addFeedbackCopyButtons();
    }
};

/**
 * Batch scan requests into the next animation frame
 *
 * @param {NodeList|Array} nodes
 * @returns {void}
 */
const scheduleScanClassic = (nodes) => {
    let hasElements = false;
    const enqueue = (target) => {
        if (!target) return;
        const contentRoot = target.closest ? target.closest(CONTENT_SELECTOR) : null;
        pendingNodesClassic.add(contentRoot || target);
        hasElements = true;
    };

    nodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
            enqueue(node);
            return;
        }
        if (node.parentElement) {
            enqueue(node.parentElement);
        }
    });

    if (hasElements && !scheduledClassic) {
        scheduledClassic = true;
        requestAnimationFrame(flushScanClassic);
    }
};

/**
 * Scan existing content before observing DOM mutations
 *
 * @returns {void}
 */
const initClassic = () => {
    const root = getRoot();
    scanClassic(root);
    if (config.copyButton) {
        addFeedbackCopyButtons();
    }

    const observer = new MutationObserver((mutations) => {
        const nodesToScan = [];
        mutations.forEach((mutation) => {
            if (mutation.type === 'characterData') {
                if (mutation.target.parentElement) {
                    nodesToScan.push(mutation.target.parentElement);
                }
                return;
            }
            if (mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach((node) => nodesToScan.push(node));
            }
        });
        if (nodesToScan.length > 0) {
            scheduleScanClassic(nodesToScan);
        }
    });

    observer.observe(root, { childList: true, subtree: true, characterData: true });
};

/**
 * @param {Object} [userConfig={}] - Feature overrides
 * @returns {void}
 */
export const start = (userConfig = {}) => {
    config = { ...config, ...userConfig };
    if (config.math) {
        bindMathSelectionCopyHandler();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initClassic();
        });
    } else {
        initClassic();
    }
};
