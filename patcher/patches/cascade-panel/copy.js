/** Inject copy controls into Cascade message content and feedback rows */

import { BOUND_ATTR, BUTTON_CLASS } from './constants.js';
import { CHECK_ICON_SVG, COPY_ICON_SVG } from './icons.js';
import { extractFormattedContent } from './extract.js';
import { captureRawText, isEditable, writeClipboard } from './utils.js';

const copyTimers = new WeakMap();

/**
 * @param {string} label
 * @param {string} icon
 * @returns {string}
 */
const buttonMarkup = (label, icon) => `<span>${label}</span>${icon}`;

/**
 * Update the visible copy state and the accessible label together
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
 * Only native button tags receive a type attribute
 *
 * @param {Object} [options]
 * @param {string} [options.className] - Extra CSS class
 * @param {string} [options.tag='button'] - HTML tag for the copy control
 * @returns {HTMLElement}
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
 * @param {HTMLElement} button
 * @param {Object} options
 * @param {() => (string|Promise<string>)} options.getText - Provides the text to copy
 * @param {number} [options.copiedDuration=1200] - Milliseconds to show the copied state
 * @param {boolean} [options.preventDefault=true]
 * @param {boolean} [options.stopPropagation=true]
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
 * Skip editable and previously bound content
 *
 * @param {Element} contentEl
 * @returns {void}
 */
export const ensureContentCopyButton = (contentEl) => {
    if (!contentEl || isEditable(contentEl)) return;

    captureRawText(contentEl);
    if (contentEl.getAttribute(BOUND_ATTR) === '1') return;
    contentEl.setAttribute(BOUND_ATTR, '1');

    const pos = getComputedStyle(contentEl).position;
    if (pos === 'static') {
        contentEl.style.position = 'relative';
    }

    const button = createCopyButton({ className: BUTTON_CLASS });
    bindCopyButton(button, {
        getText: () => extractFormattedContent(contentEl, true),
        copiedDuration: 1200,
        preventDefault: true,
        stopPropagation: true,
    });
    contentEl.appendChild(button);
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

        const copyBtn = createCopyButton({ className: 'custom-copy-btn', tag: 'div' });
        bindCopyButton(copyBtn, {
            getText: () => {
                let content = '';
                let searchNode = parentContainer;

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
