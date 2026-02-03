/**
 * Manager patch entry point
 * Runs independently of the legacy Cascade Panel
 * 
 * Enhancements
 * - KaTeX formula rendering
 * - Mermaid diagram rendering
 * - Message copy buttons
 * - Custom message font size
 * - Message width limit
 */

// Resolve patch assets relative to this script
const SCRIPT_BASE = new URL('./', import.meta.url).href;

const DEFAULT_CONFIG = {
    mermaid: false,
    math: false,
    copyButton: true,
    tableColor: false,
    maxWidthEnabled: false,
    maxWidthRatio: 75,
    fontSizeEnabled: false,
    fontSize: 16,
};

/**
 * Reuse an existing link for the resolved URL to avoid duplicate loads
 *
 * @param {string} href - Stylesheet path relative to the patch entry script
 * @returns {Promise<void>} Resolves when the resource is available
 */
const loadStyle = (href) => {
    return new Promise((resolve, reject) => {
        const fullHref = new URL(href, SCRIPT_BASE).href;
        if (document.querySelector(`link[href="${fullHref}"]`)) {
            resolve();
            return;
        }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = fullHref;
        link.onload = () => resolve();
        link.onerror = () => reject(new Error(`Failed to load CSS: ${fullHref}`));
        document.head.appendChild(link);
    });
};

/**
 * Read config.json and fall back to defaults if loading fails
 *
 * @returns {Promise<Object>}
 */
const loadConfig = async () => {
    try {
        const configUrl = new URL('config.json', SCRIPT_BASE).href;
        const res = await fetch(configUrl, { cache: 'no-store' });
        if (!res.ok) {
            throw new Error(`Config load failed: ${res.status}`);
        }
        const data = await res.json();
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            return DEFAULT_CONFIG;
        }
        return { ...DEFAULT_CONFIG, ...data };
    } catch {
        return DEFAULT_CONFIG;
    }
};

/**
 * Set --manager-panel-font-size from the Manager font preference
 *
 * @param {Object} userConfig
 * @returns {void}
 */
const applyFontSize = (userConfig) => {
    const root = document.documentElement;
    if (!root) return;

    if (!userConfig?.fontSizeEnabled) {
        root.style.removeProperty('--manager-panel-font-size');
        return;
    }

    const size = Number(userConfig.fontSize);
    if (!Number.isFinite(size) || size <= 0) {
        root.style.removeProperty('--manager-panel-font-size');
        return;
    }

    root.style.setProperty('--manager-panel-font-size', `${size}px`);
};

/**
 * Set --manager-panel-max-width-ratio from the Manager width preference
 *
 * @param {Object} userConfig
 * @returns {void}
 */
const applyMaxWidth = (userConfig) => {
    const root = document.documentElement;
    if (!root) return;

    if (!userConfig?.maxWidthEnabled) {
        root.removeAttribute('data-manager-panel-max-width');
        root.style.removeProperty('--manager-panel-max-width-ratio');
        return;
    }

    const ratio = Number(userConfig.maxWidthRatio);
    if (!Number.isFinite(ratio) || ratio <= 0) {
        root.removeAttribute('data-manager-panel-max-width');
        root.style.removeProperty('--manager-panel-max-width-ratio');
        return;
    }

    const clamped = Math.min(100, Math.max(30, ratio));
    root.setAttribute('data-manager-panel-max-width', '1');
    root.style.setProperty('--manager-panel-max-width-ratio', String(clamped));
};

(async () => {
    console.log('[Manager Panel] 补丁加载中...');

    try {
        await loadStyle('manager-panel.css');
    } catch (err) {
        console.warn('[Manager Panel] 样式加载失败:', err);
    }

    const config = await loadConfig();

    // Publish the configuration for modules that read it directly
    window.__MANAGER_CONFIG__ = config;

    applyFontSize(config);
    applyMaxWidth(config);

    const { start } = await import('./scan.js');
    start(config);

    console.log('[Manager Panel] 补丁已启动', config);
})();
