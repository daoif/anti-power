/** Load the Manager patch independently of the legacy Cascade Panel */

// Resolve patch assets relative to this script
const SCRIPT_BASE = new URL('./', import.meta.url).href;

const DEFAULT_CONFIG = {
    mermaid: false,
    math: false,
    copyButton: true,
    tableColor: false,
    fontSizeEnabled: false,
    fontSize: 16,
};

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

(async () => {
    console.log('[Manager Panel] 补丁加载中...');

    try {
        await loadStyle('manager-panel.css');
    } catch (err) {
        console.warn('[Manager Panel] 样式加载失败:', err);
    }

    const config = await loadConfig();
    applyFontSize(config);

    const { start } = await import('./scan.js');
    start(config);

    console.log('[Manager Panel] 补丁已启动', config);
})();
