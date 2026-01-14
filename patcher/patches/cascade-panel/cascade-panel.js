/** Load the legacy Cascade Panel enhancements selected in config.json */

import { loadStyle } from './utils.js';

const DEFAULT_CONFIG = { mermaid: true, math: true, copyButton: true, tableColor: true };

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
        return data;
    } catch {
        return DEFAULT_CONFIG;
    }
};

const loadTableFix = () => {
    void loadStyle('./cascade-panel/table-fix.css').catch((error) => {
        console.warn('[Cascade] 表格样式加载失败:', error);
    });
};

(async () => {
    const config = await loadConfig();

    if (config.tableColor) {
        loadTableFix();
    }

    const { start } = await import('./scan.js');
    start(config);
})();
