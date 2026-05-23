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

import { BOUND_ATTR, BUTTON_CLASS, BOTTOM_BUTTON_CLASS, COPY_BTN_CLASS } from './constants.js';
import { CHECK_ICON_SVG, COPY_ICON_SVG } from './icons.js';
import { extractFormattedContent } from './extract.js';
import { captureRawText, isEditable, writeClipboard } from './utils.js';

const copyTimers = new WeakMap();
let mathSelectionCopyBound = false;

const extractLatexFromMath = (mathEl) => {
    const annotation = mathEl.querySelector('annotation[encoding="application/x-tex"]');
    if (annotation) {
        const latex = annotation.textContent;
        const isDisplay = mathEl.closest('.katex-display') !== null;
        return isDisplay ? `$$${latex}$$` : `$${latex}$`;
    }

    if (mathEl.tagName === 'MJX-CONTAINER') {
        const ariaLabel = mathEl.getAttribute('aria-label');
        if (ariaLabel) {
            const isDisplay = mathEl.getAttribute('display') === 'true' ||
                mathEl.classList.contains('MathJax_Display');
            return isDisplay ? `$$${ariaLabel}$$` : `$${ariaLabel}$`;
        }
    }

    return null;
};

const getElementForNode = (node) => {
    if (!node) return null;
    if (node.nodeType === Node.ELEMENT_NODE) return node;
    if (node.nodeType === Node.DOCUMENT_NODE) return node.body || document.body;
    return node.parentElement || null;
};

const isEditableSelection = (node) => {
    const el = getElementForNode(node);
    return !!el?.closest?.('[contenteditable="true"], textarea, input');
};

const rangeIntersectsNode = (range, node) => {
    try {
        return range.intersectsNode(node);
    } catch {
        return false;
    }
};

const getMathElementForNode = (node) => {
    const el = getElementForNode(node);
    if (!el?.closest) return null;
    if (el.matches?.('.katex, mjx-container')) return el;
    return el.closest('.katex, mjx-container');
};

const getMathCopyBoundaryNode = (mathEl) => {
    if (!mathEl?.closest) return mathEl;
    return mathEl.closest('.katex-display, .katex-inline-wrapper, .katex-display-wrapper') || mathEl;
};

const collectIntersectingMathElements = (range) => {
    const containerEl = getElementForNode(range.commonAncestorContainer);
    if (!containerEl) return [];

    const mathElements = new Set();
    const ancestorMath = getMathElementForNode(range.commonAncestorContainer);
    if (ancestorMath && rangeIntersectsNode(range, ancestorMath)) {
        mathElements.add(ancestorMath);
    }

    if (containerEl.matches?.('.katex, mjx-container') && rangeIntersectsNode(range, containerEl)) {
        mathElements.add(containerEl);
    }

    containerEl.querySelectorAll?.('.katex, mjx-container').forEach((mathEl) => {
        if (rangeIntersectsNode(range, mathEl)) {
            mathElements.add(mathEl);
        }
    });

    return [...mathElements];
};

const isBoundaryInsideNode = (boundaryContainer, node) => {
    const boundaryEl = getElementForNode(boundaryContainer);
    return !!boundaryEl && (boundaryEl === node || node.contains(boundaryEl));
};

const expandRangeToWholeMath = (range, mathElements) => {
    const expanded = range.cloneRange();

    mathElements.forEach((mathEl) => {
        const boundaryNode = getMathCopyBoundaryNode(mathEl);
        if (!boundaryNode) return;
        if (isBoundaryInsideNode(range.startContainer, boundaryNode)) {
            expanded.setStartBefore(boundaryNode);
        }
        if (isBoundaryInsideNode(range.endContainer, boundaryNode)) {
            expanded.setEndAfter(boundaryNode);
        }
    });

    return expanded;
};

const stripPatchControls = (root) => {
    root.querySelectorAll?.(
        `.${BUTTON_CLASS}, .${BOTTOM_BUTTON_CLASS}, .${COPY_BTN_CLASS}, .custom-copy-btn`
    ).forEach((el) => el.remove());
};

const replaceRenderedMathWithLatex = (root) => {
    root.querySelectorAll?.('.katex, mjx-container').forEach((mathEl) => {
        const latex = extractLatexFromMath(mathEl);
        if (latex) {
            mathEl.replaceWith(document.createTextNode(latex));
        }
    });
};

const normalizeSelectionText = (text) => {
    return (text || '')
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};

const extractTextFromSelectedFragment = (fragment) => {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-99999px';
    container.style.top = '0';
    container.style.opacity = '0';
    container.style.pointerEvents = 'none';
    container.style.whiteSpace = 'pre-wrap';
    container.appendChild(fragment);

    stripPatchControls(container);
    replaceRenderedMathWithLatex(container);

    if (!document.body) {
        return normalizeSelectionText(container.textContent || '');
    }

    document.body.appendChild(container);
    const text = container.innerText || container.textContent || '';
    container.remove();
    return normalizeSelectionText(text);
};

const extractSelectionTextWithLatex = (selection) => {
    const parts = [];
    let containsMath = false;

    for (let i = 0; i < selection.rangeCount; i += 1) {
        const range = selection.getRangeAt(i);
        if (range.collapsed) continue;

        const mathElements = collectIntersectingMathElements(range);
        if (mathElements.length === 0) continue;

        containsMath = true;
        const expandedRange = expandRangeToWholeMath(range, mathElements);
        const text = extractTextFromSelectedFragment(expandedRange.cloneContents());
        if (text) parts.push(text);
    }

    if (!containsMath) return '';
    return normalizeSelectionText(parts.join('\n'));
};

export const bindMathSelectionCopyHandler = () => {
    if (mathSelectionCopyBound) return;
    mathSelectionCopyBound = true;

    document.addEventListener('copy', (event) => {
        if (!event.clipboardData) return;

        const selection = document.getSelection();
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;

        for (let i = 0; i < selection.rangeCount; i += 1) {
            if (isEditableSelection(selection.getRangeAt(i).commonAncestorContainer)) {
                return;
            }
        }

        const text = extractSelectionTextWithLatex(selection);
        if (!text) return;

        event.clipboardData.setData('text/plain', text);
        event.preventDefault();
        event.stopImmediatePropagation();
    }, true);
};

/**
 * 获取配置
 *
 * 从全局变量读取。
 *
 * @returns {Object} 配置对象
 */
const getConfig = () => {
    return window.__CASCADE_CONFIG__ || {};
};

/**
 * 根据配置获取按钮标签文字
 *
 * @param {boolean} copied - 是否已复制
 * @param {'top'|'bottom'} position - 按钮位置
 * @returns {string} 按钮标签文字
 */
const getLabelText = (copied, position) => {
    if (copied) return 'Copied!';

    const config = getConfig();
    const style = config.copyButtonStyle || 'icon';
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
 *
 * @param {string} label - 标签文字
 * @param {string} icon - 图标 SVG 字符串
 * @returns {string} HTML 字符串
 */
const buttonMarkup = (label, icon) => {
    if (label) {
        return `<span>${label}</span>${icon}`;
    }
    return icon; // 仅图标模式
};

/**
 * 设置复制按钮的状态与可访问性标签
 *
 * @param {HTMLElement} button - 复制按钮元素
 * @param {boolean} copied - 是否已复制
 * @returns {void}
 */
export const setCopyState = (button, copied) => {
    const position = button.dataset.copyPosition || 'top';
    const label = getLabelText(copied, position);
    const config = getConfig();
    const style = config.copyButtonStyle || 'icon';

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
 *
 * 当 tag 不是 button 时不会设置 type，而是设置 role 和 tabIndex。
 *
 * @param {Object} [options] - 配置选项
 * @param {string} [options.className] - 额外类名
 * @param {string} [options.tag='button'] - 使用的标签名
 * @param {'top'|'bottom'} [options.position='top'] - 按钮位置
 * @returns {HTMLElement} 创建的按钮元素
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
 *
 * @param {HTMLElement} button - 复制按钮元素
 * @param {Object} options - 配置选项
 * @param {() => (string|Promise<string>)} options.getText - 获取待复制文本
 * @param {number} [options.copiedDuration=1200] - 成功状态保持时间
 * @param {boolean} [options.preventDefault=true] - 是否阻止默认行为
 * @param {boolean} [options.stopPropagation=true] - 是否阻止事件冒泡
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
 * 绑定智能感应事件
 *
 * 鼠标在按钮附近才显示按钮。
 *
 * @param {HTMLElement} contentEl - 内容容器
 * @param {HTMLElement} topBtn - 右上角按钮
 * @param {HTMLElement} [bottomBtn] - 右下角按钮（可选）
 * @returns {void}
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
 *
 * 可编辑区域与已绑定节点会跳过，避免重复渲染。
 *
 * @param {Element} contentEl - 内容容器元素
 * @returns {void}
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
    const smartHover = config.copyButtonSmartHover ?? true;
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
 * 为反馈区域插入复制按钮
 *
 * 向上回溯查找消息内容，最多遍历 20 层，避免深层 DOM 导致性能问题。
 *
 * @returns {void}
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
