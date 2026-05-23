/** Inject copy controls into message content and feedback rows, with configurable labels and hover behavior */

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
 * Read the configuration published by the patch entry point
 *
 * @returns {Object}
 */
const getConfig = () => {
    return window.__CASCADE_CONFIG__ || {};
};

/**
 * @param {boolean} copied - Whether to show the copied state
 * @param {'top'|'bottom'} position - Top or bottom button position
 * @returns {string} Button label
 */
const getLabelText = (copied, position) => {
    if (copied) return 'Copied!';

    const config = getConfig();
    const style = config.copyButtonStyle || 'icon';
    const customText = config.copyButtonCustomText || '';

    switch (style) {
        case 'icon':
            return '';
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
 * @param {string} label - Button label
 * @param {string} icon - SVG markup for the icon
 * @returns {string} Button markup
 */
const buttonMarkup = (label, icon) => {
    if (label) {
        return `<span>${label}</span>${icon}`;
    }
    return icon;
};

/**
 * Update the visible copy state and the accessible label together
 *
 * @param {HTMLElement} button
 * @param {boolean} copied - Whether to show the copied state
 * @returns {void}
 */
export const setCopyState = (button, copied) => {
    const position = button.dataset.copyPosition || 'top';
    const label = getLabelText(copied, position);
    const config = getConfig();
    const style = config.copyButtonStyle || 'icon';

    // Use a text-only custom label until the success checkmark is shown
    let icon = '';
    if (style !== 'custom' || copied) {
        icon = copied ? CHECK_ICON_SVG : COPY_ICON_SVG;
    }

    button.innerHTML = buttonMarkup(label, icon);
    button.classList.toggle('copied', copied);
    button.setAttribute('aria-label', label || 'Copy');
};

/**
 * Give non-button tags button semantics via role and tabIndex
 *
 * @param {Object} [options]
 * @param {string} [options.className] - Extra CSS class
 * @param {string} [options.tag='button'] - HTML tag for the copy control
 * @param {'top'|'bottom'} [options.position='top'] - Top or bottom button position
 * @returns {HTMLElement}
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
 * @param {HTMLElement} button
 * @param {Object} options
 * @param {() => (string|Promise<string>)} options.getText - Provides the text to copy
 * @param {number} [options.copiedDuration=1200] - Milliseconds to show the copied state
 * @param {boolean} [options.preventDefault=true] - Whether to prevent the click's default action
 * @param {boolean} [options.stopPropagation=true] - Whether to stop the click from bubbling
 * @param {() => void} [options.onMissing] - Runs when there is no text to copy
 * @param {() => void} [options.onCopyFailed] - Runs when clipboard writing fails
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
 * Reveal each copy button only while the pointer is near its corner
 *
 * @param {HTMLElement} contentEl - Message content container
 * @param {HTMLElement} topBtn - Top-right copy button
 * @param {HTMLElement} [bottomBtn] - Optional bottom-right button
 * @returns {void}
 */
const bindSmartHover = (contentEl, topBtn, bottomBtn) => {
    contentEl.addEventListener('mousemove', (e) => {
        const rect = contentEl.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (x > rect.width - 120 && y < 60) {
            topBtn.classList.add('cascade-copy-button-visible');
        } else {
            topBtn.classList.remove('cascade-copy-button-visible');
        }

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
 * Skip editable and previously bound content
 *
 * @param {Element} contentEl - Message content container
 * @returns {void}
 */
export const ensureContentCopyButton = (contentEl) => {
    if (!contentEl || isEditable(contentEl)) return;

    captureRawText(contentEl);
    if (contentEl.getAttribute(BOUND_ATTR) === '1') return;
    contentEl.setAttribute(BOUND_ATTR, '1');

    // Keep absolute positioning relative to the content container
    const pos = getComputedStyle(contentEl).position;
    if (pos === 'static') {
        contentEl.style.position = 'relative';
    }

    const config = getConfig();
    const smartHover = config.copyButtonSmartHover ?? true;
    const bottomPosition = config.copyButtonShowBottom || 'float';

    // Top-right hover button
    const topButton = createCopyButton({ className: BUTTON_CLASS, position: 'top' });
    bindCopyButton(topButton, {
        getText: () => extractFormattedContent(contentEl, true),
        copiedDuration: 1200,
        preventDefault: true,
        stopPropagation: true,
    });
    contentEl.appendChild(topButton);

    // The floating bottom-right button shares the content container as its positioning anchor
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

    if (smartHover) {
        contentEl.classList.add('smart-hover');
        bindSmartHover(contentEl, topButton, bottomButton);
    }
};

/**
 * Search up to 20 ancestors from the feedback row to bound DOM traversal
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
