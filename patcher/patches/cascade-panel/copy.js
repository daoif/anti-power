/**
 * Cascade Panel 复制功能模块
 *
 * 本模块提供复制按钮的创建、绑定和状态管理功能，
 * 用于实现一键复制消息内容的能力。
 *
 * 主要功能：
 * - 创建复制按钮（支持 button 和 div 两种标签）
 * - 绑定复制事件（带成功反馈状态）
 * - 内容区域复制按钮注入
 * - 反馈区域复制按钮注入
 */

import { BOUND_ATTR, BUTTON_CLASS } from './constants.js';
import { CHECK_ICON_SVG, COPY_ICON_SVG } from './icons.js';
import { extractFormattedContent } from './extract.js';
import { captureRawText, isEditable, writeClipboard } from './utils.js';

const copyTimers = new WeakMap();

/**
 * 生成按钮内部文本与图标的 HTML
 * @param {string} label
 * @param {string} icon
 * @returns {string}
 */
const buttonMarkup = (label, icon) => `<span>${label}</span>${icon}`;

/**
 * 设置复制按钮的状态与可访问性标签
 * @param {HTMLElement} button
 * @param {boolean} copied
 * @returns {void}
 */
export const setCopyState = (button, copied) => {
    const label = copied ? 'Copied!' : 'Copy';
    const icon = copied ? CHECK_ICON_SVG : COPY_ICON_SVG;
    button.innerHTML = buttonMarkup(label, icon);
    button.classList.toggle('copied', copied);
    button.setAttribute('aria-label', label);
};

/**
 * 创建复制按钮元素
 * @param {Object} [options]
 * @param {string} [options.className] - 额外类名
 * @param {string} [options.tag='button'] - 使用的标签名
 * @returns {HTMLElement}
 * 边界：当 tag 不是 button 时不会设置 type
 */
export const createCopyButton = ({ className, tag = 'button' } = {}) => {
    const button = document.createElement(tag);
    if (tag === 'button') {
        button.type = 'button';
    } else {
        button.setAttribute('role', 'button');
        button.tabIndex = 0;
    }
    if (className) {
        button.className = className;
    }
    button.classList.add('cascade-copy-btn');
    setCopyState(button, false);
    return button;
};

/**
 * 绑定复制逻辑到按钮
 * @param {HTMLElement} button
 * @param {Object} options
 * @param {() => (string|Promise<string>)} options.getText - 获取待复制文本
 * @param {number} [options.copiedDuration=1200] - 成功状态保持时间
 * @param {boolean} [options.preventDefault=true]
 * @param {boolean} [options.stopPropagation=true]
 * @param {() => void} [options.onMissing] - 无内容时回调
 * @param {() => void} [options.onCopyFailed] - 复制失败回调
 * @returns {void}
 */
export const bindCopyButton = (
    button,
    {
        getText,
        copiedDuration = 1200,
        preventDefault = true,
        stopPropagation = true,
        onMissing,
        onCopyFailed,
    } = {}
) => {
    if (typeof getText !== 'function') return;

    const handleCopy = async (event) => {
        if (preventDefault) event.preventDefault();
        if (stopPropagation) event.stopPropagation();
        let text = '';
        try {
            const resolved = await getText();
            text = resolved == null ? '' : String(resolved);
        } catch (error) {
            if (onCopyFailed) onCopyFailed(error);
            return;
        }
        if (!text.trim()) {
            if (onMissing) onMissing();
            return;
        }
        const ok = await writeClipboard(text);
        if (!ok) {
            if (onCopyFailed) onCopyFailed();
            return;
        }

        setCopyState(button, true);
        const existingTimer = copyTimers.get(button);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }
        const timerId = window.setTimeout(() => {
            setCopyState(button, false);
            copyTimers.delete(button);
        }, copiedDuration);
        copyTimers.set(button, timerId);
    };

    button.addEventListener('click', handleCopy);

    if (button.tagName !== 'BUTTON') {
        button.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                if (event.key === ' ') event.preventDefault();
                handleCopy(event);
            }
        });
    }
};

/**
 * 为内容区添加复制按钮并绑定处理逻辑
 * @param {Element} contentEl
 * @returns {void}
 * 边界：可编辑区域与已绑定节点会跳过，避免重复渲染
 */
export const ensureContentCopyButton = (contentEl) => {
    if (!contentEl || isEditable(contentEl)) return;

    captureRawText(contentEl);
    if (contentEl.getAttribute(BOUND_ATTR) === '1') return;
    // 标记已绑定，避免重复插入按钮
    contentEl.setAttribute(BOUND_ATTR, '1');

    const pos = getComputedStyle(contentEl).position;
    if (pos === 'static') {
        contentEl.style.position = 'relative';
    }

    // 右上角按钮（悬停显示）
    const topButton = createCopyButton({ className: BUTTON_CLASS });
    bindCopyButton(topButton, {
        getText: () => extractFormattedContent(contentEl, true),
        copiedDuration: 1200,
        preventDefault: true,
        stopPropagation: true,
    });
    contentEl.appendChild(topButton);

    // 智能感应：仅当鼠标移动到右上角附近时才显示按钮
    // 阈值：右侧 120px, 顶部 60px
    contentEl.addEventListener('mousemove', (e) => {
        const rect = contentEl.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // 检查是否在右上角区域
        if (x > rect.width - 120 && y < 60) {
            topButton.classList.add('cascade-copy-button-visible');
        } else {
            topButton.classList.remove('cascade-copy-button-visible');
        }
    });

    contentEl.addEventListener('mouseleave', () => {
        topButton.classList.remove('cascade-copy-button-visible');
    });
};

/**
 * 为反馈区域插入复制按钮（向上回溯查找消息内容）
 * @returns {void}
 * 说明：最多向上遍历 20 层，避免深层 DOM 导致性能问题
 */
export const addFeedbackCopyButtons = () => {
    const feedbackContainers = document.querySelectorAll('[data-tooltip-id^="up-"]');

    feedbackContainers.forEach((goodBtn) => {
        const parentContainer = goodBtn.parentElement;
        if (!parentContainer || parentContainer.querySelector('.custom-copy-btn')) {
            return;
        }

        const copyBtn = createCopyButton({ className: 'custom-copy-btn', tag: 'div' });
        bindCopyButton(copyBtn, {
            getText: () => {
                let content = '';
                let searchNode = parentContainer;

                // 向上寻找最近的消息内容容器
                for (let i = 0; i < 20; i += 1) {
                    searchNode = searchNode.parentElement;
                    if (!searchNode) break;

                    const proseElements = searchNode.querySelectorAll('.prose.prose-sm');
                    if (proseElements.length > 0) {
                        const lastProse = proseElements[proseElements.length - 1];
                        content = extractFormattedContent(lastProse);
                        break;
                    }
                }

                if (!content) return '';
                return content.trim();
            },
            copiedDuration: 2000,
            preventDefault: false,
            stopPropagation: true,
            onMissing: () => {
                console.error('[Cascade] 未找到消息内容');
            },
            onCopyFailed: () => {
                console.error('[Cascade] 复制失败');
            },
        });

        parentContainer.insertBefore(copyBtn, goodBtn);
    });
};
