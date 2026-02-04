/** Share resource loads to avoid duplicate requests for the same URL */

import { MATH_ATTR, RAW_TEXT_PROP } from './constants.js';

const stylePromises = new Map();
const scriptPromises = new Map();

const waitForResource = (el, url, cache, label) =>
    new Promise((resolve, reject) => {
        const onLoad = () => {
            el.dataset.cascadeLoaded = '1';
            delete el.dataset.cascadeLoading;
            resolve();
        };
        const onError = () => {
            cache.delete(url);
            reject(new Error(`Failed to load ${label}: ${url}`));
        };
        el.addEventListener('load', onLoad, { once: true });
        el.addEventListener('error', onError, { once: true });
    });

/**
 * Reuse an existing link for the same URL to avoid duplicate requests
 *
 * @param {string} href
 * @returns {Promise<void>} Resolves when the resource is available
 */
export const loadStyle = (href) => {
    if (!href) return Promise.reject(new Error('Missing stylesheet URL'));
    if (stylePromises.has(href)) return stylePromises.get(href);

    const existing = document.querySelector(`link[rel="stylesheet"][href="${href}"]`);
    if (existing) {
        if (existing.dataset.cascadeLoaded === '1') return Promise.resolve();
        if (existing.dataset.cascadeLoading === '1') {
            const promise = waitForResource(existing, href, stylePromises, 'stylesheet');
            stylePromises.set(href, promise);
            return promise;
        }
        return Promise.resolve();
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.crossOrigin = 'anonymous';
    link.referrerPolicy = 'no-referrer';
    link.dataset.cascadeLoading = '1';

    const promise = waitForResource(link, href, stylePromises, 'stylesheet');
    stylePromises.set(href, promise);
    document.head.appendChild(link);
    return promise;
};

/**
 * Reuse an existing script for the same URL to avoid duplicate requests
 *
 * @param {string} src
 * @returns {Promise<void>} Resolves when the resource is available
 */
export const loadScript = (src) => {
    if (!src) return Promise.reject(new Error('Missing script URL'));
    if (scriptPromises.has(src)) return scriptPromises.get(src);

    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
        if (existing.dataset.cascadeLoaded === '1') return Promise.resolve();
        if (existing.dataset.cascadeLoading === '1') {
            const promise = waitForResource(existing, src, scriptPromises, 'script');
            scriptPromises.set(src, promise);
            return promise;
        }
        return Promise.resolve();
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.referrerPolicy = 'no-referrer';
    script.dataset.cascadeLoading = '1';

    const promise = waitForResource(script, src, scriptPromises, 'script');
    scriptPromises.set(src, promise);
    document.head.appendChild(script);
    return promise;
};

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
 *
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
 *
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
