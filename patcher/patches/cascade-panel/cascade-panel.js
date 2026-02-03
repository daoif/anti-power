/** Load the legacy Cascade Panel enhancements selected in config.json */

import { loadStyle } from './utils.js';

const DEFAULT_CONFIG = {
    mermaid: true,
    math: true,
    copyButton: true,
    tableColor: true,
    fontSizeEnabled: true,
    fontSize: 20,
};

/**
 * Read config.json and fall back to defaults if loading fails
 *
 * @returns {Promise<Object>}
 */
const loadConfig = async () => {
    try {
        const res = await fetch('./cascade-panel/config.json', { cache: 'no-store' });
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
 * Set --cascade-panel-font-size for the legacy sidebar
 *
 * @param {Object} userConfig
 * @returns {void}
 */
const applyFontSize = (userConfig) => {
    const root = document.documentElement;
    if (!root) return;

    if (!userConfig?.fontSizeEnabled) {
        root.style.removeProperty('--cascade-panel-font-size');
        return;
    }

    const size = Number(userConfig.fontSize);
    if (!Number.isFinite(size) || size <= 0) {
        root.style.removeProperty('--cascade-panel-font-size');
        return;
    }

    root.style.setProperty('--cascade-panel-font-size', `${size}px`);
};

/** @returns {void} */
const loadTableFix = () => {
    void loadStyle('./cascade-panel/table-fix.css').catch((error) => {
        console.warn('[Cascade] 表格样式加载失败:', error);
    });
};

(async () => {
    const config = await loadConfig();

    // Publish the configuration for modules that read it directly
    window.__CASCADE_CONFIG__ = config;

    applyFontSize(config);

    if (config.tableColor) {
        loadTableFix();
    }

    const { start } = await import('./scan.js');
    start(config);
})();
