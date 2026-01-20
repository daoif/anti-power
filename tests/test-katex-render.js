/**
 * Test rendering formulas directly into DOM elements with katex.render
 */

const http = require('http');
const WebSocket = require('ws');

const CDP_HOST = '127.0.0.1';
const CDP_PORT = 9222;

async function getManagerPage() {
    return new Promise((resolve, reject) => {
        http.get(`http://${CDP_HOST}:${CDP_PORT}/json`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const pages = JSON.parse(data);
                const manager = pages.find(p => p.url.includes('jetski-agent'));
                resolve(manager || null);
            });
        }).on('error', reject);
    });
}

async function evaluateInPage(wsUrl, expression) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        let id = 1;

        ws.on('open', () => {
            ws.send(JSON.stringify({
                id: id++,
                method: 'Runtime.evaluate',
                params: {
                    expression,
                    returnByValue: true,
                    awaitPromise: true,
                }
            }));
        });

        ws.on('message', (msg) => {
            const response = JSON.parse(msg);
            if (response.id) {
                ws.close();
                if (response.result?.result?.value !== undefined) {
                    resolve(response.result.result.value);
                } else if (response.result?.exceptionDetails) {
                    reject(new Error(JSON.stringify(response.result.exceptionDetails, null, 2)));
                } else {
                    resolve(response.result?.result);
                }
            }
        });

        ws.on('error', reject);
    });
}

async function main() {
    console.log('[测试] 连接 Antigravity Manager...');

    const manager = await getManagerPage();
    if (!manager) {
        console.error('[错误] 未找到 Manager 页面');
        process.exit(1);
    }

    console.log('[测试] 已连接\n');

    const testCode = `
(async function() {
    const result = {
        hasKatex: !!window.katex,
        hasRenderMethod: !!window.katex?.render,
        tests: [],
    };
    
    if (!window.katex?.render) {
        result.error = 'KaTeX 没有 render 方法';
        return result;
    }
    
    // 方案 1: 使用 katex.render() 直接渲染到元素
    try {
        const container = document.createElement('span');
        container.className = 'katex-container';
        
        window.katex.render('e^{i\\\\pi} + 1 = 0', container, {
            displayMode: true,
            throwOnError: false,
            trust: true,
        });
        
        const hasKatexNode = container.querySelector('.katex') !== null;
        const htmlPreview = container.innerHTML.slice(0, 200);
        
        result.tests.push({
            name: 'katex.render() 直接渲染',
            ok: hasKatexNode,
            htmlPreview,
        });
    } catch (e) {
        result.tests.push({
            name: 'katex.render() 直接渲染',
            ok: false,
            error: e.message,
        });
    }
    
    // 方案 2: 在真实页面中创建元素并渲染
    try {
        const testContainer = document.createElement('div');
        testContainer.style.cssText = 'position:fixed;top:0;left:0;background:white;z-index:99999;padding:20px;border:2px solid red;';
        document.body.appendChild(testContainer);
        
        const mathSpan = document.createElement('span');
        testContainer.appendChild(mathSpan);
        
        window.katex.render('x^2 + y^2 = z^2', mathSpan, {
            displayMode: false,
            throwOnError: false,
            trust: true,
        });
        
        const hasKatexNode = testContainer.querySelector('.katex') !== null;
        const htmlPreview = testContainer.innerHTML.slice(0, 200);
        
        // 不删除，让用户可以看到
        result.tests.push({
            name: '在真实页面中渲染（可见）',
            ok: hasKatexNode,
            htmlPreview,
            note: '已在页面左上角显示红框测试区域',
        });
        
        // 3秒后删除
        setTimeout(() => testContainer.remove(), 5000);
    } catch (e) {
        result.tests.push({
            name: '在真实页面中渲染',
            ok: false,
            error: e.message,
        });
    }
    
    // 方案 3: 完整的替换流程模拟
    try {
        // 模拟：找到公式文本 -> 创建 span -> 用 katex.render 渲染 -> 替换原文本
        const testDiv = document.createElement('div');
        testDiv.textContent = '前缀文本 $$e^{i\\\\pi}$$ 后缀文本';
        document.body.appendChild(testDiv);
        
        // 解析公式
        const text = testDiv.textContent;
        const dollarRe = /\\$\\$([^$]+)\\$\\$/g;
        let match;
        const parts = [];
        let lastIndex = 0;
        
        while ((match = dollarRe.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
            }
            parts.push({ type: 'math', content: match[1], display: true });
            lastIndex = dollarRe.lastIndex;
        }
        if (lastIndex < text.length) {
            parts.push({ type: 'text', content: text.slice(lastIndex) });
        }
        
        // 清空并重建
        testDiv.innerHTML = '';
        for (const part of parts) {
            if (part.type === 'text') {
                testDiv.appendChild(document.createTextNode(part.content));
            } else {
                const mathSpan = document.createElement('span');
                mathSpan.className = part.display ? 'katex-display' : 'katex-inline';
                try {
                    window.katex.render(part.content, mathSpan, {
                        displayMode: part.display,
                        throwOnError: false,
                        trust: true,
                    });
                } catch {
                    mathSpan.textContent = '$$' + part.content + '$$';
                }
                testDiv.appendChild(mathSpan);
            }
        }
        
        const hasKatexNode = testDiv.querySelector('.katex') !== null;
        const htmlPreview = testDiv.innerHTML.slice(0, 200);
        testDiv.remove();
        
        result.tests.push({
            name: '完整替换流程模拟',
            ok: hasKatexNode,
            htmlPreview,
        });
    } catch (e) {
        result.tests.push({
            name: '完整替换流程模拟',
            ok: false,
            error: e.message,
        });
    }
    
    return result;
})()
`;

    try {
        const result = await evaluateInPage(manager.webSocketDebuggerUrl, testCode);

        console.log('='.repeat(60));
        console.log('KaTeX 直接渲染方案测试报告');
        console.log('='.repeat(60));

        console.log('\n【KaTeX 环境】');
        console.log(`  hasKatex: ${result.hasKatex}`);
        console.log(`  hasRenderMethod: ${result.hasRenderMethod}`);

        if (result.error) {
            console.log(`\n❌ 错误: ${result.error}`);
            return;
        }

        console.log('\n【测试结果】');
        result.tests.forEach((test, i) => {
            const status = test.ok ? '✅ 成功' : '❌ 失败';
            console.log(`\n  ${i + 1}. ${test.name}: ${status}`);
            if (test.error) console.log(`     错误: ${test.error}`);
            if (test.htmlPreview) console.log(`     HTML: ${test.htmlPreview}...`);
            if (test.note) console.log(`     备注: ${test.note}`);
        });

        const allOk = result.tests.every(t => t.ok);
        console.log('\n' + '='.repeat(60));
        console.log('结论');
        console.log('='.repeat(60));

        if (allOk) {
            console.log('\n✅ katex.render() 方案可行！');
            console.log('   建议修改 math.js，使用 katex.render() 直接渲染到元素，');
            console.log('   而不是使用 renderToString() + DOMParser 解析。');
        } else {
            console.log('\n❌ 部分测试失败，需要进一步分析');
        }

    } catch (err) {
        console.error('[错误]', err.message);
    }
}

main().catch(console.error);
