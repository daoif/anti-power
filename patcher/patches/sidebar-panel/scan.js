/**
 * Sidebar Panel DOM 扫描与监听
 *
 * 本模块是 Sidebar 补丁的核心调度器，完全独立于 cascade-panel。
 *
 * 主要职责：
 * - 扫描侧边栏内容区域并触发渲染
 * - 监听侧边栏 DOM 变更以处理新增内容
 */

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

/**
 * 功能配置
 */
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

/**
 * 清理当前侧边栏监听
 */
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
 * 扫描根节点
 *
 * 查找匹配内容选择器的节点并触发渲染。
 *
 * @param {HTMLElement} root - 要扫描的根节点
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
 * 解析扫描根节点
 *
 * 从目标节点向上查找最近的内容容器或 section。
 *
 * @param {Node} target - 目标节点
 * @returns {HTMLElement|null} 扫描根节点
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

/**
 * 批量处理待扫描节点
 */
const flushScan = () => {
    scheduled = false;
    const nodes = [...pendingNodes];
    pendingNodes.clear();

    nodes.forEach((node) => {
        if (node.isConnected) scanClassic(node);
    });
};

/**
 * 调度扫描任务
 *
 * 将节点加入待扫描队列，在下一帧执行。
 *
 * @param {NodeList|Array} nodes - 要扫描的节点列表
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

/**
 * 绑定指定的侧边栏根节点并开始监听
 *
 * @param {HTMLElement} root - 侧边栏根节点
 */
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

/**
 * 初始化
 */
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

    // 定期检查侧边栏容器是否重新挂载
    rootCheckTimer = setInterval(() => {
        tryBind();
    }, 1500);
};

/**
 * 模块入口
 *
 * 接收配置并启动扫描模块。
 *
 * @param {Object} [userConfig={}] - 用户配置
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
