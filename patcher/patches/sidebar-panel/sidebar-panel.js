/**
 * Sidebar Panel 补丁入口
 * 完全独立于 cascade-panel
 * 
 * 功能：
 * - 数学公式渲染 (KaTeX)
 * - Mermaid 图表渲染
 * - 复制按钮
 * - 字体大小调整
 * - 对话区域最大宽度
 */

// 获取当前脚本的基础路径
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
 * 动态加载 CSS
 *
 * 重复 URL 会复用已有 link，避免重复请求。
 *
 * @param {string} href - 样式表相对路径
 * @returns {Promise<void>} 加载完成后 resolve
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
 * 加载配置文件
 *
 * 从 config.json 读取用户配置，失败时返回默认配置。
 *
 * @returns {Promise<Object>} 配置对象
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
 * 应用字体大小配置
 *
 * 设置 CSS 变量 --sidebar-panel-font-size。
 *
 * @param {Object} userConfig - 用户配置对象
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
 * 应用对话区域最大宽度
 *
 * 设置 CSS 变量 --sidebar-panel-max-width-ratio。
 *
 * @param {Object} userConfig - 用户配置对象
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

/**
 * 补丁入口
 *
 * 加载样式和配置，并启动扫描模块。
 */
(async () => {
    console.log('[Sidebar Panel] 补丁加载中...');

    // 加载样式
    try {
        await loadStyle('sidebar-panel.css');
    } catch (err) {
        console.warn('[Sidebar Panel] 样式加载失败:', err);
    }

    // 加载配置
    const config = await loadConfig();

    // 将配置设置到全局变量，供其他模块读取
    window.__SIDEBAR_CONFIG__ = config;

    applyFontSize(config);
    applyMaxWidth(config);

    // 启动扫描
    const { start } = await import('./scan.js');
    start(config);

    console.log('[Sidebar Panel] 补丁已启动', config);
})();
