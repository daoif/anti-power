/** Load the modern Sidebar patch independently of the legacy Cascade Panel */

// Resolve patch assets relative to this script
const SCRIPT_BASE = new URL('./', import.meta.url).href;

const DEFAULT_CONFIG = {
    mermaid: true,
    math: true,
    copyButton: true,
    tableColor: true,
    maxWidthEnabled: false,
    maxWidthRatio: 75,
    fontSizeEnabled: true,
    fontSize: 16,
    copyButtonSmartHover: true,
    copyButtonShowBottom: 'float',
    copyButtonStyle: 'icon',
    copyButtonCustomText: '',
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
 * Set --sidebar-panel-font-size from the Sidebar font preference
 *
 * @param {Object} userConfig
 * @returns {void}
 */
const applyFontSize = (userConfig) => {
    const root = document.documentElement;
    if (!root) return;

    if (!userConfig?.fontSizeEnabled) {
        root.style.removeProperty('--sidebar-panel-font-size');
        return;
    }

    const size = Number(userConfig.fontSize);
    if (!Number.isFinite(size) || size <= 0) {
        root.style.removeProperty('--sidebar-panel-font-size');
        return;
    }

    root.style.setProperty('--sidebar-panel-font-size', `${size}px`);
};

/**
 * Set --sidebar-panel-max-width-ratio from the Sidebar width preference
 *
 * @param {Object} userConfig
 * @returns {void}
 */
const applyMaxWidth = (userConfig) => {
    const root = document.documentElement;
    if (!root) return;

    if (!userConfig?.maxWidthEnabled) {
        root.removeAttribute('data-sidebar-panel-max-width');
        root.style.removeProperty('--sidebar-panel-max-width-ratio');
        return;
    }

    const ratio = Number(userConfig.maxWidthRatio);
    if (!Number.isFinite(ratio) || ratio <= 0) {
        root.removeAttribute('data-sidebar-panel-max-width');
        root.style.removeProperty('--sidebar-panel-max-width-ratio');
        return;
    }

    const clamped = Math.min(100, Math.max(30, ratio));
    root.setAttribute('data-sidebar-panel-max-width', '1');
    root.style.setProperty('--sidebar-panel-max-width-ratio', String(clamped));
};

(async () => {
    console.log('[Sidebar Panel] 补丁加载中...');

    try {
        await loadStyle('sidebar-panel.css');
    } catch (err) {
        console.warn('[Sidebar Panel] 样式加载失败:', err);
    }

    const config = await loadConfig();

    // Publish the configuration for modules that read it directly
    window.__SIDEBAR_CONFIG__ = config;

    applyFontSize(config);
    applyMaxWidth(config);

    const { start } = await import('./scan.js');
    start(config);

    console.log('[Sidebar Panel] 补丁已启动', config);
})();
