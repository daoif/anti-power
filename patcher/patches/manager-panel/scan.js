/**
 * Manager Panel DOM 扫描与监听
 *
 * 本模块是 Manager 补丁的核心调度器，完全独立于 cascade-panel。
 *
 * 主要职责：
 * - 扫描 DOM 中的内容区域并触发渲染
 * - 监听 DOM 变更以处理新增内容
 *
 * 扫描策略：
 * - 使用 MutationObserver 监听 DOM 变更
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

// -------------------------
// Classic scan (current)
// -------------------------

/**
 * 扫描根节点
 * @param {HTMLElement} root
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
        if (node.isConnected) scanClassic(node);
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

    // 反馈区按钮常驻，设置定时扫描
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
