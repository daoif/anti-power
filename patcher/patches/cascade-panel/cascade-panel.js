/**
 * Anti-Power 补丁入口
 * 根据配置文件动态加载功能模块
 */

import { loadStyle } from './utils.js';

const DEFAULT_CONFIG = {
    mermaid: true,
    math: true,
    copyButton: true,
    tableColor: true,
    fontSizeEnabled: true,
    fontSize: 16,
};

/**
 * 加载配置文件
 *
 * 从 config.json 读取用户配置，失败时返回默认配置。
 *
 * @returns {Promise<Object>} 配置对象
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
        // 默认全部启用
        return DEFAULT_CONFIG;
    }
};

/**
 * 应用字体大小配置
 *
 * 设置 CSS 变量 --cascade-panel-font-size。
 *
 * @param {Object} userConfig - 用户配置对象
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

/**
 * 动态加载表格修复样式
 *
 * @returns {void}
 */
const loadTableFix = () => {
    void loadStyle('./cascade-panel/table-fix.css').catch((error) => {
        console.warn('[Cascade] 表格样式加载失败:', error);
    });
};

/**
 * 补丁入口
 *
 * 加载配置并启动扫描模块。
 */
(async () => {
    const config = await loadConfig();

    // 将配置设置到全局变量，供其他模块读取
    window.__CASCADE_CONFIG__ = config;

    applyFontSize(config);

    // 表格颜色修复（CSS 动态加载）
    if (config.tableColor) {
        loadTableFix();
    }

    // 启动扫描模块，传入配置
    const { start } = await import('./scan.js');
    start(config);
})();
