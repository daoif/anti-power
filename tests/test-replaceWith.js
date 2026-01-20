/**
 * Check whether replaceWith can replace a formula text node
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
    const MATH_HINT_RE = /\\$\\$|\\\\\\(|\\\\\\[|\\\\begin\\{|\\$(?!\\s)([^$\\n]+?)\\$/;
    const CONTENT_SELECTOR = '.leading-relaxed.select-text';
    
    const result = {
        tests: [],
        errors: [],
    };
    
    // 1. 找到第一个包含公式的文本节点
    const contentNodes = document.querySelectorAll(CONTENT_SELECTOR);
    let targetTextNode = null;
    let targetContent = null;
    
    for (const contentEl of contentNodes) {
        const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while ((node = walker.nextNode())) {
            const text = node.textContent || '';
            if (text.includes('$$') && MATH_HINT_RE.test(text)) {
                targetTextNode = node;
                targetContent = contentEl;
                break;
            }
        }
        if (targetTextNode) break;
    }
    
    if (!targetTextNode) {
        return { error: '未找到包含公式的文本节点' };
    }
    
    result.originalText = targetTextNode.textContent.slice(0, 100);
    result.parentTag = targetTextNode.parentElement?.tagName;
    result.parentConnected = targetTextNode.parentElement?.isConnected;
    result.nodeConnected = targetTextNode.isConnected;
    
    // 2. 测试 KaTeX 渲染
    try {
        const latex = 'e^{i\\\\pi} + 1 = 0';
        const html = window.katex.renderToString(latex, {
            displayMode: true,
            throwOnError: false,
            trust: true,
        });
        result.katexHtml = html.slice(0, 200);
        result.katexOk = true;
    } catch (e) {
        result.katexError = e.message;
        result.katexOk = false;
    }
    
    // 3. 测试 DOMParser
    try {
        const testHtml = '<span class="test-katex">测试</span>';
        const parser = new DOMParser();
        const doc = parser.parseFromString(testHtml, 'text/html');
        const fragment = document.createDocumentFragment();
        doc.body.childNodes.forEach((node) => {
            fragment.appendChild(document.importNode(node, true));
        });
        result.domParserOk = true;
        result.fragmentChildCount = fragment.childNodes.length;
    } catch (e) {
        result.domParserError = e.message;
        result.domParserOk = false;
    }
    
    // 4. 测试 replaceWith（在一个临时容器中）
    try {
        const tempDiv = document.createElement('div');
        tempDiv.textContent = '原始文本';
        document.body.appendChild(tempDiv);
        
        const textNode = tempDiv.firstChild;
        const newSpan = document.createElement('span');
        newSpan.textContent = '替换后';
        newSpan.className = 'test-replace';
        
        textNode.replaceWith(newSpan);
        
        result.replaceWithOk = tempDiv.innerHTML.includes('替换后');
        result.replaceWithResult = tempDiv.innerHTML;
        
        tempDiv.remove();
    } catch (e) {
        result.replaceWithError = e.message;
        result.replaceWithOk = false;
    }
    
    // 5. 尝试在实际节点上进行替换（使用一个小的测试标记）
    try {
        // 不实际替换公式，只测试能否在父元素中追加
        const parent = targetTextNode.parentElement;
        const testMarker = document.createElement('span');
        testMarker.className = 'math-test-marker';
        testMarker.style.display = 'none';
        testMarker.textContent = 'test';
        
        parent.appendChild(testMarker);
        result.appendToParentOk = !!parent.querySelector('.math-test-marker');
        testMarker.remove();
    } catch (e) {
        result.appendToParentError = e.message;
        result.appendToParentOk = false;
    }
    
    // 6. 检查是否在 Shadow DOM 中
    try {
        let el = targetTextNode.parentElement;
        let inShadow = false;
        while (el) {
            if (el.getRootNode() instanceof ShadowRoot) {
                inShadow = true;
                break;
            }
            el = el.parentElement;
        }
        result.inShadowDOM = inShadow;
    } catch (e) {
        result.inShadowDOM = 'unknown';
    }
    
    // 7. 尝试实际渲染一个公式节点
    try {
        const latex = 'x^2';
        const html = window.katex.renderToString(latex, { displayMode: false, throwOnError: false });
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const fragment = document.createDocumentFragment();
        doc.body.childNodes.forEach((node) => {
            fragment.appendChild(document.importNode(node, true));
        });
        
        // 在一个测试容器中进行替换
        const testContainer = document.createElement('div');
        testContainer.textContent = '$$x^2$$';
        document.body.appendChild(testContainer);
        
        const testTextNode = testContainer.firstChild;
        testTextNode.replaceWith(fragment);
        
        result.actualReplaceOk = testContainer.querySelector('.katex') !== null;
        result.actualReplaceResult = testContainer.innerHTML.slice(0, 200);
        
        testContainer.remove();
    } catch (e) {
        result.actualReplaceError = e.message;
        result.actualReplaceOk = false;
    }
    
    return result;
})()
`;

    try {
        const result = await evaluateInPage(manager.webSocketDebuggerUrl, testCode);

        console.log('='.repeat(60));
        console.log('replaceWith 操作测试报告');
        console.log('='.repeat(60));

        console.log('\n【目标节点信息】');
        console.log(`  原始文本: "${result.originalText}..."`);
        console.log(`  父元素: <${result.parentTag}>`);
        console.log(`  父元素已连接: ${result.parentConnected}`);
        console.log(`  节点已连接: ${result.nodeConnected}`);
        console.log(`  在 Shadow DOM 中: ${result.inShadowDOM}`);

        console.log('\n【测试结果】');
        console.log(`  1. KaTeX 渲染: ${result.katexOk ? '✅ 成功' : '❌ 失败 - ' + result.katexError}`);
        console.log(`  2. DOMParser: ${result.domParserOk ? '✅ 成功' : '❌ 失败 - ' + result.domParserError}`);
        console.log(`  3. replaceWith (临时容器): ${result.replaceWithOk ? '✅ 成功' : '❌ 失败 - ' + result.replaceWithError}`);
        console.log(`  4. appendChild (真实父元素): ${result.appendToParentOk ? '✅ 成功' : '❌ 失败 - ' + result.appendToParentError}`);
        console.log(`  5. 完整渲染替换 (测试容器): ${result.actualReplaceOk ? '✅ 成功' : '❌ 失败 - ' + result.actualReplaceError}`);

        if (result.actualReplaceOk) {
            console.log(`\n  渲染结果: ${result.actualReplaceResult}...`);
        }

        console.log('\n' + '='.repeat(60));
        console.log('分析');
        console.log('='.repeat(60));

        if (result.actualReplaceOk && result.appendToParentOk) {
            console.log('所有操作都成功，问题可能是：');
            console.log('  - 时机问题：renderMath 调用时内容尚未稳定');
            console.log('  - 重复调用：MATH_ATTR 被提前设置，后续内容变化未重新处理');
            console.log('  - TreeWalker 问题：遍历时跳过了某些节点');
        } else {
            console.log('发现操作失败，具体检查上述测试结果');
        }

    } catch (err) {
        console.error('[错误]', err.message);
    }
}

main().catch(console.error);
