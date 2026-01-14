import { CONTENT_SELECTOR } from './constants.js';
import { addFeedbackCopyButtons, ensureContentCopyButton } from './copy.js';
import { renderMath } from './math.js';
import { renderMermaid } from './mermaid.js';

/** The patch entry point supplies feature overrides */
let config = {
    mermaid: true,
    math: true,
    copyButton: true,
    tableColor: true
};

/**
 * @param {Element} root
 * @returns {void}
 */
const scan = (root) => {
    if (!root) return;

    root.querySelectorAll(CONTENT_SELECTOR).forEach((node) => {
        if (config.copyButton) {
            ensureContentCopyButton(node);
        }
        if (config.math) {
            void renderMath(node);
        }
    });

    if (config.mermaid) {
        root.querySelectorAll('[class*="language-mermaid"]').forEach((node) => {
            void renderMermaid(node);
        });
    }

    if (config.copyButton) {
        addFeedbackCopyButtons();
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

let scheduled = false;
/**
 * Batch DOM mutations into one scan per animation frame
 * @returns {void}
 */
const scheduleScan = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
        scheduled = false;
        scan(getRoot());
    });
};

/**
 * Scan existing content before observing DOM mutations
 * @returns {void}
 */
const init = () => {
    const root = getRoot();
    scan(root);

    const observer = new MutationObserver(scheduleScan);
    observer.observe(root, { childList: true, subtree: true });
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
