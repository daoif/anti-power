import { MATH_ATTR, RAW_TEXT_PROP } from './constants.js';

/**
 * Reuse an existing link for the same URL to avoid duplicate requests
 *
 * @param {string} href
 * @returns {Promise<void>} Resolves when the resource is available
 */
export const loadStyle = (href) =>
    new Promise((resolve, reject) => {
        if (!href) return reject(new Error('Missing stylesheet URL'));
        if (document.querySelector(`link[href="${href}"]`)) return resolve();
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.onload = () => resolve();
        link.onerror = () => reject(new Error(`Failed to load stylesheet: ${href}`));
        document.head.appendChild(link);
    });

/**
 * Reuse an existing script for the same URL to avoid duplicate requests
 *
 * @param {string} src
 * @returns {Promise<void>} Resolves when the resource is available
 */
export const loadScript = (src) =>
    new Promise((resolve, reject) => {
        if (!src) return reject(new Error('Missing script URL'));
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
    });

/**
 * Check the closest editable ancestor to protect inputs from renderer changes
 *
 * @param {Element} el
 * @returns {boolean} True if enhancement should be skipped
 */
export const isEditable = (el) =>
    !!el.closest('[contenteditable="true"], textarea, input');

/**
 * Handle SVGAnimatedString as well as string class names
 * @param {Element} el
 * @returns {string}
 */
export const getClassString = (el) => {
    const className = el?.className || '';
    if (typeof className === 'string') return className;
    if (className && typeof className.baseVal === 'string') return className.baseVal;
    return '';
};

/**
 * Fall back to execCommand if the Clipboard API fails
 * Empty text returns false, and the browser may require a user gesture
 * @param {string} text
 * @returns {Promise<boolean>} True if the clipboard write succeeds
 */
export const writeClipboard = async (text) => {
    if (!text) return false;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // execCommand fallback
        }
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textArea);
    return ok;
};

/**
 * Cache text before math rendering and keep the original once it has been rendered
 *
 * @param {Element} contentEl
 * @returns {void}
 */
export const captureRawText = (contentEl) => {
    if (!contentEl) return;
    if (contentEl.getAttribute(MATH_ATTR) === '1') return;
    const raw = contentEl.innerText !== undefined
        ? contentEl.innerText
        : contentEl.textContent ?? '';
    contentEl[RAW_TEXT_PROP] = raw;
};
