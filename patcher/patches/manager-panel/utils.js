/** Keep Manager utilities independent of the legacy Cascade Panel */

const TRUSTED_TYPES_POLICY_NAMES = [
    'renderCodeBlock',
    'notebookChatEditController',
    'tokenizeToString',
    'notebookRenderer',
    'editorGhostText',
    'editorViewLayer',
    'stickyScrollViewLayer',
    'cellRendererEditorText',
    'diffReview',
    'diffEditorWidget',
    'defaultWorkerFactory',
    'domLineBreaksComputer',
    'amdLoader',
];
const TRUSTED_TYPES_FALLBACK_NAMES = ['mermaid', 'dompurifyMermaid', 'dompurify'];
const TRUSTED_TYPES_BLOCKED = new Set(['none', 'allow-duplicates']);
let cachedPolicy = null;
let amdSuspendCount = 0;
let amdSnapshot = null;

const getTrustedTypesFromCsp = () => {
    const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    const content = meta?.getAttribute('content') || '';
    const match = content.match(/trusted-types([^;]+)/i);
    if (!match) return [];
    return match[1]
        .split(/\s+/)
        .map((token) => token.replace(/'/g, '').trim())
        .filter((token) => token && !TRUSTED_TYPES_BLOCKED.has(token));
};

const getTrustedTypesPolicy = () => {
    const tt = window.trustedTypes;
    if (!tt) return null;

    if (cachedPolicy) return cachedPolicy;

    if (typeof tt.getPolicy === 'function') {
        for (const name of [...TRUSTED_TYPES_POLICY_NAMES, ...TRUSTED_TYPES_FALLBACK_NAMES]) {
            const existing = tt.getPolicy(name);
            // Prefer policies that expose createHTML for renderer output
            if (existing && (typeof existing.createHTML === 'function' || typeof existing.createScriptURL === 'function')) {
                cachedPolicy = existing;
                return cachedPolicy;
            }
        }
    }

    if (typeof tt.createPolicy === 'function') {
        const candidates = [];
        const pushUnique = (name) => {
            if (!name || candidates.includes(name)) return;
            candidates.push(name);
        };

        TRUSTED_TYPES_POLICY_NAMES.forEach(pushUnique);
        getTrustedTypesFromCsp().forEach(pushUnique);
        TRUSTED_TYPES_FALLBACK_NAMES.forEach(pushUnique);

        for (const name of candidates) {
            try {
                cachedPolicy = tt.createPolicy(name, {
                    createHTML: (html) => html,
                    createScriptURL: (url) => url,
                });
                return cachedPolicy;
            } catch {
                // Try the next policy name
            }
        }
    }

    return null;
};

const createTrustedScriptURL = (url) => {
    const policy = getTrustedTypesPolicy();
    if (policy?.createScriptURL) {
        try {
            return policy.createScriptURL(url);
        } catch {
            return url;
        }
    }
    return url;
};

const createTrustedHTML = (html, policy) => {
    const p = policy || getTrustedTypesPolicy();
    if (p?.createHTML) {
        try {
            return p.createHTML(html);
        } catch {
            return html;
        }
    }
    return html;
};

/**
 * Apply the supplied Trusted Types policy during DOM operations
 * @param {Function} fn - DOM operation to run with the policy
 * @param {Object} externalPolicy - Optional external Trusted Types policy
 */
export const withTrustedHTML = async (fn, externalPolicy = null) => {
    const policy = externalPolicy || getTrustedTypesPolicy();
    if (!policy?.createHTML) {
        // Without a compatible policy, let the caller's DOM operation run unchanged
        return fn();
    }

    const patches = [];
    const createHTMLWrapper = (html) => createTrustedHTML(html, policy);

    // Patch Element.prototype.innerHTML
    const elementDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (elementDescriptor?.set) {
        const patchedElementDescriptor = {
            configurable: true,
            enumerable: elementDescriptor.enumerable,
            get() { return elementDescriptor.get?.call(this); },
            set(value) {
                if (typeof value === 'string') {
                    try {
                        elementDescriptor.set.call(this, createHTMLWrapper(value));
                        return;
                    } catch { /* fall through */ }
                }
                elementDescriptor.set.call(this, value);
            },
        };
        Object.defineProperty(Element.prototype, 'innerHTML', patchedElementDescriptor);
        patches.push(() => Object.defineProperty(Element.prototype, 'innerHTML', elementDescriptor));
    }

    // Wrap the SVG innerHTML setter too when the browser exposes it
    if (typeof SVGElement !== 'undefined') {
        const svgDescriptor = Object.getOwnPropertyDescriptor(SVGElement.prototype, 'innerHTML');
        if (svgDescriptor?.set) {
            const patchedSvgDescriptor = {
                configurable: true,
                enumerable: svgDescriptor.enumerable,
                get() { return svgDescriptor.get?.call(this); },
                set(value) {
                    if (typeof value === 'string') {
                        try {
                            svgDescriptor.set.call(this, createHTMLWrapper(value));
                            return;
                        } catch { /* fall through */ }
                    }
                    svgDescriptor.set.call(this, value);
                },
            };
            Object.defineProperty(SVGElement.prototype, 'innerHTML', patchedSvgDescriptor);
            patches.push(() => Object.defineProperty(SVGElement.prototype, 'innerHTML', svgDescriptor));
        }
    }

    // Patch Element.prototype.insertAdjacentHTML
    const origInsertAdjacentHTML = Element.prototype.insertAdjacentHTML;
    if (typeof origInsertAdjacentHTML === 'function') {
        Element.prototype.insertAdjacentHTML = function (position, text) {
            if (typeof text === 'string') {
                try {
                    return origInsertAdjacentHTML.call(this, position, createHTMLWrapper(text));
                } catch { /* fall through */ }
            }
            return origInsertAdjacentHTML.call(this, position, text);
        };
        patches.push(() => { Element.prototype.insertAdjacentHTML = origInsertAdjacentHTML; });
    }

    try {
        return await fn();
    } finally {
        patches.forEach(restore => restore());
    }
};

const suspendAmd = () => {
    const defineFn = window.define;
    if (!defineFn || !defineFn.amd) {
        return () => { };
    }

    if (amdSuspendCount === 0) {
        amdSnapshot = {
            defineFn,
            amd: defineFn.amd,
            defineReplaced: false,
        };
        let amdDisabled = false;
        try {
            defineFn.amd = undefined;
            amdDisabled = !defineFn.amd;
        } catch {
            amdDisabled = false;
        }

        if (!amdDisabled) {
            try {
                window.define = undefined;
                amdSnapshot.defineReplaced = true;
            } catch {
                // Leave a read-only AMD define untouched
            }
        }
    }

    amdSuspendCount += 1;
    let released = false;

    return () => {
        if (released) return;
        released = true;
        amdSuspendCount = Math.max(amdSuspendCount - 1, 0);

        if (amdSuspendCount === 0 && amdSnapshot) {
            if (amdSnapshot.defineReplaced) {
                try {
                    window.define = amdSnapshot.defineFn;
                } catch {
                    // Ignore restore errors
                }
            }
            try {
                amdSnapshot.defineFn.amd = amdSnapshot.amd;
            } catch {
                // Ignore restore errors
            }
            amdSnapshot = null;
        }
    };
};

/**
 * @param {string} href
 * @returns {Promise<void>}
 */
export const loadStyle = (href) => {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`link[href="${href}"]`)) {
            resolve();
            return;
        }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.onload = () => resolve();
        link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`));
        document.head.appendChild(link);
    });
};

/**
 * @param {string} src
 * @returns {Promise<void>}
 */
export const loadScript = (src) => {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        const trustedSrc = createTrustedScriptURL(src);
        const restoreAmd = suspendAmd();
        script.src = trustedSrc;
        script.onload = () => {
            restoreAmd();
            resolve();
        };
        script.onerror = () => {
            restoreAmd();
            reject(new Error(`Failed to load script: ${src}`));
        };
        document.head.appendChild(script);
    });
};

const COPY_LABEL = 'Copy';
const COPIED_LABEL = 'Copied!';
const SVG_NS = 'http://www.w3.org/2000/svg';

const createSvg = () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    return svg;
};

const createCopyIcon = () => {
    const svg = createSvg();
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute(
        'd',
        'M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184'
    );
    svg.appendChild(path);
    svg.classList.add('manager-copy-icon', 'manager-copy-icon-copy');
    return svg;
};

const createCheckIcon = () => {
    const svg = createSvg();
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', 'M4.5 12.75l6 6 9-13.5');
    svg.appendChild(path);
    svg.classList.add('manager-copy-icon', 'manager-copy-icon-check');
    return svg;
};

/**
 * @param {HTMLElement} btn
 * @param {boolean} copied
 */
export const setCopyState = (btn, copied) => {
    if (!btn) return;
    const label = copied ? COPIED_LABEL : COPY_LABEL;
    const span = btn.querySelector('span');
    if (span) span.textContent = label;
    btn.classList.toggle('copied', copied);
    btn.setAttribute('aria-label', label);
};

/**
 * @param {string} className
 * @returns {HTMLButtonElement}
 */
export const createCopyButton = (className) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    const span = document.createElement('span');
    span.textContent = COPY_LABEL;

    btn.appendChild(span);
    btn.appendChild(createCopyIcon());
    btn.appendChild(createCheckIcon());
    setCopyState(btn, false);
    return btn;
};

/**
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export const copyToClipboard = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success;
    }
};

/** @param {HTMLElement} btn */
export const showCopySuccess = (btn) => {
    setCopyState(btn, true);
    setTimeout(() => {
        setCopyState(btn, false);
    }, 1500);
};
