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
} from './constants.js';
import { ensureContentCopyButton, addFeedbackCopyButtons } from './copy.js';
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

    const contentRoot = current.closest(CONTENT_SELECTOR);
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
};
