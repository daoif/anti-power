/**
 * Cascade Panel 内容扫描模块
 *
 * 本模块是补丁的核心调度器，负责：
 * - 扫描 DOM 中的内容区域并触发渲染
 * - 监听 DOM 变更以处理新增内容
 *
 * 扫描策略：
 * - 使用 MutationObserver 监听 DOM 变更
 * - 直接渲染内容区
 *
 * 模块入口为 start() 函数，接收配置并启动扫描。
 */

import { CONTENT_SELECTOR } from './constants.js';
import { ensureContentCopyButton, addFeedbackCopyButtons } from './copy.js';
import { renderMath } from './math.js';
import { renderMermaid } from './mermaid.js';

/**
 * 功能配置（由入口传入）
 */
let config = {
    mermaid: true,
    math: true,
    copyButton: true,
    tableColor: true,
    fontSizeEnabled: true,
    fontSize: 20,
};

/**
 * 获取渲染根节点，按优先级依次寻找
 * @returns {Element}
 */
const getRoot = () =>
    document.getElementById('chat') ||
    document.getElementById('react-app') ||
    document.body;

// -------------------------
// Classic scan (current)
// -------------------------

/**
 * 扫描根节点并处理需要增强的内容区域（v2.0.1 原样逻辑）
 * @param {Element} root
 * @returns {void}
 */
const scanClassic = (root) => {
    if (!root || !root.isConnected) return;

    // 检查根节点本身及子节点是否匹配内容选择器
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
 * 批量处理待扫描节点（v2.0.1 原样逻辑）
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
 * 调度扫描任务（v2.0.1 原样逻辑）
 * @param {NodeList|Array} nodes
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
 * 初始化扫描与 MutationObserver（v2.0.1 原样逻辑）
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
 * 模块入口：接收配置并启动
 * @param {Object} userConfig - 用户配置
 * @returns {void}
 */
export const start = (userConfig = {}) => {
    // 合并用户配置
    config = { ...config, ...userConfig };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initClassic();
        });
    } else {
        initClassic();
    }
};
