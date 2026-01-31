/** Observe content mutations and defer rendering until the message has finished or the content settles */

import { CONTENT_SELECTOR } from './constants.js';
import { ensureContentCopyButton, addFeedbackCopyButtons } from './copy.js';
import { renderMath } from './math.js';
import { renderMermaid } from './mermaid.js';

/** The patch entry point supplies feature overrides */
let config = {
    mermaid: true,
    math: true,
    copyButton: true,
    tableColor: true,
    fontSizeEnabled: true,
    fontSize: 20,
};

const FEEDBACK_SELECTOR = '[data-tooltip-id^="up-"], [data-tooltip-id^="down-"]';
const MAX_FEEDBACK_DEPTH = 20;
const STABLE_RENDER_DELAY = 360;
const STABLE_RENDER_MAX_WAIT = 2500;
const deferredRenders = new WeakMap();

/**
 * Use feedback controls to detect the end of a streamed message
 * @param {Element} contentEl
 * @returns {boolean}
 */
const hasFeedbackButtons = (contentEl) => {
    let node = contentEl;
    for (let i = 0; i < MAX_FEEDBACK_DEPTH && node; i += 1) {
        if (node.querySelector?.(FEEDBACK_SELECTOR)) {
            const contents = node.querySelectorAll(CONTENT_SELECTOR);
            if (contents.length === 0) return false;
            return contents[contents.length - 1] === contentEl;
        }
        node = node.parentElement;
    }
    return false;
};

/**
 * @param {Element} contentEl
 * @returns {void}
 */
const clearDeferredRender = (contentEl) => {
    const state = deferredRenders.get(contentEl);
    if (!state) return;
    clearTimeout(state.timerId);
    deferredRenders.delete(contentEl);
};

/**
 * @param {Element} root
 * @returns {void}
 */
const renderMermaidWithin = (root) => {
    if (!config.mermaid) return;
    const mermaidNodes = [];
    if (root.matches && root.matches('[class*="language-mermaid"]')) {
        mermaidNodes.push(root);
    }
    mermaidNodes.push(...root.querySelectorAll('[class*="language-mermaid"]'));
    mermaidNodes.forEach((node) => {
        void renderMermaid(node);
    });
};

/**
 * Defer rendering until content settles or feedback controls appear
 * @param {Element} contentEl
 * @returns {void}
 */
const scheduleDeferredRender = (contentEl) => {
    if (!contentEl || !contentEl.isConnected) return;

    const text = contentEl.textContent || '';
    const now = Date.now();
    const existing = deferredRenders.get(contentEl);

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
        timerId: 0,
    };

    const attempt = () => {
        deferredRenders.delete(contentEl);
        if (!contentEl || !contentEl.isConnected) return;

        const currentText = contentEl.textContent || '';
        const currentTime = Date.now();
        if (currentText !== state.lastText) {
            state.lastText = currentText;
            state.lastChange = currentTime;
            state.timerId = window.setTimeout(attempt, STABLE_RENDER_DELAY);
            deferredRenders.set(contentEl, state);
            return;
        }

        const idleMs = currentTime - state.lastChange;
        const complete = hasFeedbackButtons(contentEl);
        const feedbackExpected = document.querySelector(FEEDBACK_SELECTOR) !== null;

        if (complete) {
            renderContentNode(contentEl, true);
            return;
        }

        if (!feedbackExpected && idleMs >= STABLE_RENDER_DELAY) {
            renderContentNode(contentEl, true);
            return;
        }

        if (feedbackExpected && idleMs >= STABLE_RENDER_MAX_WAIT) {
            renderContentNode(contentEl, true);
            return;
        }

        state.timerId = window.setTimeout(attempt, STABLE_RENDER_DELAY);
        deferredRenders.set(contentEl, state);
    };

    state.timerId = window.setTimeout(attempt, STABLE_RENDER_DELAY);
    deferredRenders.set(contentEl, state);
};

/**
 * Defer rendering until content settles or feedback controls appear
 * @param {Element} contentEl
 * @param {boolean} [force=false] - Skip the completion check when true
 * @returns {void}
 */
const renderContentNode = (contentEl, force = false) => {
    if (!contentEl || !contentEl.isConnected) return;

    if (config.copyButton) {
        ensureContentCopyButton(contentEl);
    }

    const ready = force || hasFeedbackButtons(contentEl);
    if (!ready) {
        scheduleDeferredRender(contentEl);
        return;
    }

    clearDeferredRender(contentEl);

    if (config.math) {
        void renderMath(contentEl);
    }
    renderMermaidWithin(contentEl);
};

/**
 * @param {Element} root
 * @returns {void}
 */
const scan = (root) => {
    if (!root || !root.isConnected) return;

    // Include the root because the mutated node can itself be a content region
    const contentNodes = [];
    if (root.matches && root.matches(CONTENT_SELECTOR)) {
        contentNodes.push(root);
    }
    contentNodes.push(...root.querySelectorAll(CONTENT_SELECTOR));

    const contentSet = new Set(contentNodes);
    contentNodes.forEach((node) => renderContentNode(node));

    if (config.mermaid) {
        const mermaidNodes = [];
        if (root.matches && root.matches('[class*="language-mermaid"]')) {
            mermaidNodes.push(root);
        }
        mermaidNodes.push(...root.querySelectorAll('[class*="language-mermaid"]'));

        mermaidNodes.forEach((node) => {
            const contentRoot = node.closest?.(CONTENT_SELECTOR);
            if (contentRoot && contentSet.has(contentRoot)) {
                return;
            }
            void renderMermaid(node);
        });
    }
};

/**
 * Prefer chat, then react-app, then body as the render root
 * @returns {Element}
 */
const getRoot = () =>
    document.getElementById('chat') ||
    document.getElementById('react-app') ||
    document.body;

let pendingNodes = new Set();
let scheduled = false;

const flushScan = () => {
    scheduled = false;
    const nodes = [...pendingNodes];
    pendingNodes.clear();

    nodes.forEach(node => {
        if (node.isConnected) scan(node);
    });
};

/** @param {NodeList|Array} nodes */
const resolveScanRoot = (target) => {
    if (!target) return null;
    if (target.nodeType === Node.TEXT_NODE) {
        target = target.parentElement;
    }
    if (target.closest) {
        const contentRoot = target.closest(CONTENT_SELECTOR);
        if (contentRoot) return contentRoot;
    }

    let node = target;
    for (let i = 0; i < MAX_FEEDBACK_DEPTH && node; i += 1) {
        const candidate = node.querySelector?.(CONTENT_SELECTOR);
        if (candidate) return candidate;
        node = node.parentElement;
    }

    return target;
};

const scheduleScan = (nodes) => {
    let hasElements = false;
    const enqueue = (target) => {
        if (!target) return;
        const scanRoot = resolveScanRoot(target);
        if (!scanRoot) return;
        pendingNodes.add(scanRoot);
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

    if (hasElements && !scheduled) {
        scheduled = true;
        requestAnimationFrame(flushScan);
    }
};

/**
 * Scan existing content before observing DOM mutations
 * @returns {void}
 */
const init = () => {
    const root = getRoot();
    scan(root);

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
            scheduleScan(nodesToScan);
        }
    });

    observer.observe(root, { childList: true, subtree: true, characterData: true });

    // Poll for new feedback rows when the bottom copy button is moved there
    if (config.copyButton && config.copyButtonBottomPosition === 'feedback') {
        const scanFeedback = () => {
            addFeedbackCopyButtons();
        };
        scanFeedback();
        setInterval(scanFeedback, 2000);
    }
};

/**
 * @param {Object} userConfig - Feature overrides
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
