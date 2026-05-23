/** Observe the modern Sidebar DOM and dispatch enhancements independently of the legacy Cascade Panel */

import {
    PANEL_SELECTOR,
    CONTENT_SELECTOR,
    SECTION_SELECTOR,
    STRUCTURED_CONTENT_SELECTOR,
} from './constants.js';
import {
    ensureContentCopyButton,
    addFeedbackCopyButtons,
    bindMathSelectionCopyHandler,
} from './copy.js';
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

const MIN_CONTENT_TEXT_LENGTH = 8;
const EDITABLE_SELECTOR = [
    'textarea',
    'input',
    '[contenteditable="true"]',
    '[contenteditable="plaintext-only"]',
    '[role="textbox"]',
    '[data-lexical-editor="true"]',
    '.ProseMirror',
    '.cm-editor',
    '.monaco-editor',
].join(',');
const CONTROL_SELECTOR = [
    'button',
    '[role="button"]',
    '[data-tooltip-id]',
    '[aria-label*="copy" i]',
    '[aria-label*="like" i]',
    '[aria-label*="dislike" i]',
    '[aria-label*="thumb" i]',
].join(',');

const isElementVisible = (node) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
};

const isEditableArea = (node) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    return !!(
        node.matches?.(EDITABLE_SELECTOR) ||
        node.closest?.(EDITABLE_SELECTOR) ||
        node.querySelector?.(EDITABLE_SELECTOR)
    );
};

const isPatchOrControlArea = (node) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return true;
    return !!(
        node.closest?.('.sidebar-copy-btn, .sidebar-mermaid-container') ||
        node.matches?.(CONTROL_SELECTOR) ||
        node.closest?.(CONTROL_SELECTOR)
    );
};

const containsNativeControls = (node) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    return !!node.querySelector?.(CONTROL_SELECTOR);
};

const isEligibleContentNode = (node, { allowControls = false } = {}) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    if (isEditableArea(node) || isPatchOrControlArea(node)) return false;
    if (!allowControls && containsNativeControls(node)) return false;
    return true;
};

const hasRenderableContent = (node) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    if (!isEligibleContentNode(node, { allowControls: true })) {
        return false;
    }

    if (node.matches?.(STRUCTURED_CONTENT_SELECTOR) || node.querySelector?.(STRUCTURED_CONTENT_SELECTOR)) {
        return true;
    }

    const text = (node.innerText || node.textContent || '').trim();
    return text.length >= MIN_CONTENT_TEXT_LENGTH && /[\s\n]|[`*_#$|\\]/.test(text);
};

const resolveContentCandidate = (node) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return null;

    const explicit = node.matches?.(CONTENT_SELECTOR)
        ? node
        : node.closest?.(CONTENT_SELECTOR);
    if (
        explicit &&
        explicit.closest?.(PANEL_SELECTOR) &&
        isEligibleContentNode(explicit, { allowControls: true })
    ) {
        return explicit;
    }

    const structured = node.matches?.(STRUCTURED_CONTENT_SELECTOR)
        ? node
        : node.closest?.(STRUCTURED_CONTENT_SELECTOR);
    if (!structured || !structured.closest?.(PANEL_SELECTOR)) return null;

    const codeBlock = structured.closest('pre, .code-block, [class*="language-"]');
    if (
        codeBlock &&
        codeBlock.closest?.(PANEL_SELECTOR) &&
        isEligibleContentNode(codeBlock, { allowControls: true }) &&
        hasRenderableContent(codeBlock)
    ) {
        return codeBlock;
    }

    const section = structured.closest(SECTION_SELECTOR);
    if (section && isEligibleContentNode(section) && hasRenderableContent(section)) return section;

    const container = structured.closest('article, section, li, p, blockquote, table, ol, ul, pre, div');
    if (
        container &&
        container.closest?.(PANEL_SELECTOR) &&
        isEligibleContentNode(container) &&
        hasRenderableContent(container)
    ) {
        return container;
    }

    return isEligibleContentNode(structured) && hasRenderableContent(structured) ? structured : null;
};

const collectContentNodes = (root) => {
    const nodes = new Set();

    const addCandidate = (node) => {
        const candidate = resolveContentCandidate(node);
        if (candidate && isElementVisible(candidate)) {
            nodes.add(candidate);
        }
    };

    if (root.matches?.(CONTENT_SELECTOR) || hasRenderableContent(root)) {
        addCandidate(root);
    }

    root.querySelectorAll(CONTENT_SELECTOR).forEach(addCandidate);
    root.querySelectorAll(STRUCTURED_CONTENT_SELECTOR).forEach(addCandidate);

    return [...nodes].filter((node, _, all) => (
        !all.some((other) => other !== node && other.contains(node))
    ));
};

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

    const contentNodes = collectContentNodes(root);

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

    const contentRoot = resolveContentCandidate(current);
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
    if (config.math) {
        bindMathSelectionCopyHandler();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
};
