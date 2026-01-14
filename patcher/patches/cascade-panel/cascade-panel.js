/** Load the legacy Cascade Panel enhancements selected in config.json */

const loadConfig = async () => {
    try {
        const res = await fetch('./cascade-panel/config.json');
        return await res.json();
    } catch {
        return { mermaid: true, math: true, copyButton: true, tableColor: true };
    }
};

const loadTableFix = () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './cascade-panel/table-fix.css';
    document.head.appendChild(link);
};

(async () => {
    const config = await loadConfig();

    if (config.tableColor) {
        loadTableFix();
    }

    const { start } = await import('./scan.js');
    start(config);
})();
