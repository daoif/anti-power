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
 * - 支持配置化（智能感应、按钮位置、按钮样式）
 */

import { BOUND_ATTR, BUTTON_CLASS, BOTTOM_BUTTON_CLASS } from './constants.js';
import { CHECK_ICON_SVG, COPY_ICON_SVG } from './icons.js';
import { extractFormattedContent } from './extract.js';
import { captureRawText, isEditable, writeClipboard } from './utils.js';

const copyTimers = new WeakMap();

/**
 * 获取配置（从全局变量读取）
 * @returns {Object}
 */
const getConfig = () => {
    return window.__CASCADE_CONFIG__ || {};
};

/**
 * 根据配置获取按钮标签文字
 * @param {boolean} copied - 是否已复制
 * @param {'top'|'bottom'} position - 按钮位置
 * @returns {string}
 */
const getLabelText = (copied, position) => {
    if (copied) return 'Copied!';

    const config = getConfig();
    const style = config.copyButtonStyle || 'arrow';
    const customText = config.copyButtonCustomText || '';

    switch (style) {
        case 'icon':
            return ''; // 仅图标，无文字
        case 'chinese':
            return '复制';
        case 'custom':
            return customText || '复制';
        case 'arrow':
        default:
            return position === 'top' ? '↓Copy' : '↑Copy';
    }
};

/**
 * 生成按钮内部文本与图标的 HTML
 * @param {string} label
 * @param {string} icon
 * @returns {string}
 */
const buttonMarkup = (label, icon) => {
    if (label) {
        return `<span>${label}</span>${icon}`;
    }
    return icon; // 仅图标模式
};

/**
 * 设置复制按钮的状态与可访问性标签
 * @param {HTMLElement} button
 * @param {boolean} copied
 * @returns {void}
 */
export const setCopyState = (button, copied) => {
    const position = button.dataset.copyPosition || 'top';
    const label = getLabelText(copied, position);
    const config = getConfig();
    const style = config.copyButtonStyle || 'arrow';

    // 自定义模式不显示图标，其他模式显示图标
    let icon = '';
    if (style !== 'custom' || copied) {
        icon = copied ? CHECK_ICON_SVG : COPY_ICON_SVG;
    }

    button.innerHTML = buttonMarkup(label, icon);
    button.classList.toggle('copied', copied);
    button.setAttribute('aria-label', label || 'Copy');
};

/**
 * 创建复制按钮元素
 * @param {Object} [options]
 * @param {string} [options.className] - 额外类名
 * @param {string} [options.tag='button'] - 使用的标签名
 * @param {'top'|'bottom'} [options.position='top'] - 按钮位置
 * @returns {HTMLElement}
 * 边界：当 tag 不是 button 时不会设置 type
 */
export const createCopyButton = ({ className, tag = 'button', position = 'top' } = {}) => {
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
    button.dataset.copyPosition = position;
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
 * 绑定智能感应事件（鼠标在按钮附近才显示）
 * @param {HTMLElement} contentEl - 内容容器
 * @param {HTMLElement} topBtn - 右上角按钮
 * @param {HTMLElement} bottomBtn - 右下角按钮（可选）
 */
const bindSmartHover = (contentEl, topBtn, bottomBtn) => {
    contentEl.addEventListener('mousemove', (e) => {
        const rect = contentEl.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // 右上角区域：右侧 120px, 顶部 60px
        if (x > rect.width - 120 && y < 60) {
            topBtn.classList.add('cascade-copy-button-visible');
        } else {
            topBtn.classList.remove('cascade-copy-button-visible');
        }

        // 右下角区域：右侧 120px, 底部 60px
        if (bottomBtn) {
            if (x > rect.width - 120 && y > rect.height - 60) {
                bottomBtn.classList.add('cascade-copy-button-visible');
            } else {
                bottomBtn.classList.remove('cascade-copy-button-visible');
            }
        }
    });

    contentEl.addEventListener('mouseleave', () => {
        topBtn.classList.remove('cascade-copy-button-visible');
        if (bottomBtn) {
            bottomBtn.classList.remove('cascade-copy-button-visible');
        }
    });
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

    // 确保容器有相对定位（用于按钮的 absolute 定位）
    const pos = getComputedStyle(contentEl).position;
    if (pos === 'static') {
        contentEl.style.position = 'relative';
    }

    const config = getConfig();
    const smartHover = config.copyButtonSmartHover || false;
    const bottomPosition = config.copyButtonShowBottom || 'float';

    // 右上角按钮（悬停显示）
    const topButton = createCopyButton({ className: BUTTON_CLASS, position: 'top' });
    bindCopyButton(topButton, {
        getText: () => extractFormattedContent(contentEl, true),
        copiedDuration: 1200,
        preventDefault: true,
        stopPropagation: true,
    });
    contentEl.appendChild(topButton);

    // 右下角按钮（悬浮模式）- 同样使用 absolute 定位
    let bottomButton = null;
    if (bottomPosition === 'float') {
        bottomButton = createCopyButton({ className: BOTTOM_BUTTON_CLASS, position: 'bottom' });
        bindCopyButton(bottomButton, {
            getText: () => extractFormattedContent(contentEl, true),
            copiedDuration: 1200,
            preventDefault: true,
            stopPropagation: true,
        });
        contentEl.appendChild(bottomButton);
    }

    // 如果启用智能感应，添加类名并绑定 mousemove 事件
    if (smartHover) {
        contentEl.classList.add('smart-hover');
        bindSmartHover(contentEl, topButton, bottomButton);
    }
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

        const copyBtn = createCopyButton({ className: 'custom-copy-btn', tag: 'div', position: 'bottom' });
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
                        const parts = [];
                        proseElements.forEach((prose) => {
                            const text = extractFormattedContent(prose);
                            if (text) parts.push(text);
                        });
                        content = parts.join('\n\n');
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
