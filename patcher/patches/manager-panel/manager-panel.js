/**
 * Manager Panel 补丁入口
 * 完全独立于 cascade-panel
 * 
 * 功能：
 * - 数学公式渲染 (KaTeX)
 * - Mermaid 图表渲染
 * - 复制按钮
 * - 字体大小调整
 */

// 获取当前脚本的基础路径
const SCRIPT_BASE = new URL('./', import.meta.url).href;

const DEFAULT_CONFIG = {
    mermaid: true,
    math: true,
    copyButton: true,
    tableColor: false,
    fontSizeEnabled: false,
    fontSize: 16,
};

/**
 * 动态加载 CSS
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
 * 加载配置
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
 * 应用字体大小
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
 * 入口
 */
(async () => {
    console.log('[Manager Panel] 补丁加载中...');

    // 加载样式
    try {
        await loadStyle('manager-panel.css');
    } catch (err) {
        console.warn('[Manager Panel] 样式加载失败:', err);
    }

    // 加载配置
    const config = await loadConfig();
    applyFontSize(config);

    // 启动扫描
    const { start } = await import('./scan.js');
    start(config);

    console.log('[Manager Panel] 补丁已启动', config);
})();
