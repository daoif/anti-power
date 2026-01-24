/**
 * Inspect the Manager window over CDP
 * Start Antigravity with --remote-debugging-port=9222 and open Manager first
 */

const { chromium } = require('playwright');

(async () => {
    console.log('🔍 正在获取 WebSocket URL...');

    try {
        // Discover the browser WebSocket URL from the CDP HTTP endpoint
        const response = await fetch('http://127.0.0.1:9222/json/version');
        const info = await response.json();
        const wsUrl = info.webSocketDebuggerUrl;

        console.log('🔗 WebSocket URL:', wsUrl);

        const browser = await chromium.connectOverCDP(wsUrl);
        console.log('✅ 成功连接!');

        const contexts = browser.contexts();
        for (const context of contexts) {
            const pages = context.pages();
            for (const page of pages) {
                const title = await page.title();
                const url = page.url();

                if (title.includes('Manager') || url.includes('workbench-jetski-agent')) {
                    console.log(`\n🎯 找到 Manager 窗口: ${title}`);
                    console.log(`   URL: ${url}`);

                    page.on('console', msg => {
                        const type = msg.type().toUpperCase();
                        const text = msg.text();
                        if (type === 'ERROR' || text.includes('Manager') || text.includes('Anti-Power')) {
                            console.log(`[${type}] ${text}`);
                        }
                    });

                    page.on('pageerror', error => {
                        console.log(`[PAGE ERROR] ${error.message}`);
                    });

                    // List script tags to check whether the Manager patch loaded
                    console.log('\n📜 检查脚本状态...');
                    const scriptInfo = await page.evaluate(() => {
                        const scripts = document.querySelectorAll('script');
                        return Array.from(scripts).map(s => s.src || '[inline]');
                    });
                    console.log('加载的脚本:', scriptInfo);

                    // Check whether the renderer libraries loaded in the Manager page
                    console.log('\n🔴 获取页面错误...');
                    const errors = await page.evaluate(() => {
                        return {
                            hasKatex: typeof window.katex !== 'undefined',
                            hasMermaid: typeof window.mermaid !== 'undefined',
                            hasRenderMathInElement: typeof window.renderMathInElement !== 'undefined'
                        };
                    });
                    console.log('库加载状态:', errors);

                    // Probe the message selector against the live Manager DOM
                    console.log('\n🧪 测试内容选择器...');
                    const contentTest = await page.evaluate(() => {
                        const selector = '.leading-relaxed.select-text';
                        const elements = document.querySelectorAll(selector);
                        return {
                            selector,
                            count: elements.length,
                            samples: Array.from(elements).slice(0, 3).map(el => ({
                                tag: el.tagName,
                                textPreview: (el.textContent || '').slice(0, 100)
                            }))
                        };
                    });
                    console.log('内容元素:', JSON.stringify(contentTest, null, 2));

                    console.log('\n⏳ 持续监听 20 秒...');
                    await new Promise(r => setTimeout(r, 20000));

                    break;
                }
            }
        }

        await browser.close();
    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.log('\n💡 请确保:');
        console.log('   1. Antigravity 以 --remote-debugging-port=9222 启动');
        console.log('   2. Manager 窗口已打开');
    }
})();
