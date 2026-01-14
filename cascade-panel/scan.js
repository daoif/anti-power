import { CONTENT_SELECTOR } from './constants.js';
import { addFeedbackCopyButtons, ensureContentCopyButton } from './copy.js';
import { renderMath } from './math.js';
import { renderMermaid } from './mermaid.js';

/**
 * Each scan queries the root with selectors, so finer-grained observation could reduce the cost
 *
 * @param {Element} root
 * @returns {void}
 */
const scan = (root) => {
    if (!root) return;

    root.querySelectorAll(CONTENT_SELECTOR).forEach((node) => {
        ensureContentCopyButton(node);
        void renderMath(node);
    });

    root.querySelectorAll('[class*="language-mermaid"]').forEach((node) => {
        void renderMermaid(node);
    });

    addFeedbackCopyButtons();
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
 * Wait for DOM readiness before starting the scan
 * @returns {void}
 */
export const start = () => {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
};
