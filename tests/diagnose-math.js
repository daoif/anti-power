/**
 * Diagnose Manager math rendering failures
 * Check text node filtering, MATH_ATTR timing, and selector coverage
 */

const http = require('http');
const WebSocket = require('ws');

const CDP_HOST = '127.0.0.1';
const CDP_PORT = 9222;

const MATH_HINT_RE = /\$\$|\\\(|\\\[|\\begin\{|\$(?!\s)([^$\n]+?)\$/;

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
                    reject(new Error(response.result.exceptionDetails.text));
                } else {
                    resolve(response.result?.result);
                }
            }
        });

        ws.on('error', reject);
    });
}

async function main() {
    console.log('[诊断] 连接 Antigravity Manager...');

    const manager = await getManagerPage();
    if (!manager) {
        console.error('[错误] 未找到 Manager 页面，请确保 Antigravity 以 --remote-debugging-port=9222 启动');
        process.exit(1);
    }

    console.log('[诊断] 已连接到:', manager.url);

    const diagCode = `
(function() {
    const MATH_HINT_RE = /\\$\\$|\\\\\\(|\\\\\\[|\\\\begin\\{|\\$(?!\\s)([^$\\n]+?)\\$/;
    const CONTENT_SELECTOR = '.leading-relaxed.select-text';
    const MATH_ATTR = 'data-manager-math-rendered';
    
    const result = {
        // 1. 基础环境检测
        environment: {
            hasKatex: !!window.katex,
            katexVersion: window.katex?.version,
            contentNodes: document.querySelectorAll(CONTENT_SELECTOR).length,
        },
        
        // 2. 查找包含公式语法的文本节点
        mathTextNodes: [],
        
        // 3. 检查 MATH_ATTR 标记情况
        markedElements: [],
        
        // 4. 检查 .katex 节点
        katexNodes: document.querySelectorAll('.katex, .katex-display').length,
        
        // 5. 原始公式文本位置分析
        formulaLocations: [],
    };
    
    // 遍历所有内容节点
    const contentNodes = document.querySelectorAll(CONTENT_SELECTOR);
    contentNodes.forEach((contentEl, idx) => {
        const hasAttr = contentEl.hasAttribute(MATH_ATTR);
        const attrValue = contentEl.getAttribute(MATH_ATTR);
        
        if (hasAttr) {
            result.markedElements.push({
                index: idx,
                attrValue,
                textPreview: (contentEl.textContent || '').slice(0, 100),
            });
        }
        
        // 遍历文本节点
        const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while ((node = walker.nextNode())) {
            const text = node.textContent || '';
            if (!MATH_HINT_RE.test(text)) continue;
            
            const parent = node.parentElement;
            const ancestors = [];
            let el = parent;
            for (let i = 0; i < 5 && el; i++) {
                ancestors.push({
                    tag: el.tagName,
                    className: el.className?.toString?.() || '',
                });
                el = el.parentElement;
            }
            
            // 检查是否会被跳过
            const wouldSkip = {
                inPre: !!parent?.closest('pre'),
                inCode: !!parent?.closest('code'),
                inCodeBlock: !!parent?.closest('.code-block'),
                inMermaid: !!parent?.closest('.manager-mermaid-container'),
                inKatex: !!parent?.closest('.katex, .katex-display, mjx-container'),
            };
            
            const shouldSkip = wouldSkip.inPre || wouldSkip.inCode || 
                               wouldSkip.inCodeBlock || wouldSkip.inMermaid || wouldSkip.inKatex;
            
            result.mathTextNodes.push({
                contentIndex: idx,
                textPreview: text.slice(0, 80),
                parentTag: parent?.tagName,
                parentClass: parent?.className?.toString?.() || '',
                ancestors,
                wouldSkip,
                shouldSkip,
            });
        }
    });
    
    // 查找所有包含 $$ 的元素，不限于 content 选择器
    const allText = document.body.innerText || '';
    const dollarMatches = allText.match(/\\$\\$[^$]+\\$\\$/g) || [];
    result.dollarDollarInPage = dollarMatches.length;
    result.dollarDollarSamples = dollarMatches.slice(0, 3);
    
    // 尝试手动渲染一个公式
    if (window.katex) {
        try {
            const testHtml = window.katex.renderToString('x^2', { displayMode: false, throwOnError: false });
            result.manualRenderTest = {
                ok: true,
                htmlLength: testHtml.length,
                htmlPreview: testHtml.slice(0, 100),
            };
        } catch (e) {
            result.manualRenderTest = { ok: false, error: e.message };
        }
    }
    
    return result;
})()
`;

    console.log('[诊断] 执行诊断代码...\n');

    try {
        const result = await evaluateInPage(manager.webSocketDebuggerUrl, diagCode);

        console.log('='.repeat(60));
        console.log('数学公式渲染诊断报告');
        console.log('='.repeat(60));

        console.log('\n【1. 环境检测】');
        console.log(JSON.stringify(result.environment, null, 2));

        console.log('\n【2. 页面中的 $$ 公式】');
        console.log(`  - 找到 ${result.dollarDollarInPage} 个 $$ 公式`);
        if (result.dollarDollarSamples?.length > 0) {
            console.log('  - 示例:', result.dollarDollarSamples);
        }

        console.log('\n【3. 已渲染的 .katex 节点】');
        console.log(`  - 数量: ${result.katexNodes}`);

        console.log('\n【4. 已标记 MATH_ATTR 的元素】');
        console.log(`  - 数量: ${result.markedElements?.length || 0}`);
        result.markedElements?.forEach((el, i) => {
            console.log(`    [${i}] attrValue="${el.attrValue}", text="${el.textPreview}..."`);
        });

        console.log('\n【5. 包含公式语法的文本节点分析】');
        console.log(`  - 数量: ${result.mathTextNodes?.length || 0}`);

        if (result.mathTextNodes?.length > 0) {
            console.log('\n  详细信息:');
            result.mathTextNodes.forEach((node, i) => {
                console.log(`\n    --- 节点 ${i} ---`);
                console.log(`    文本: "${node.textPreview}..."`);
                console.log(`    父元素: <${node.parentTag}> class="${node.parentClass}"`);
                console.log(`    祖先链: ${node.ancestors?.map(a => `<${a.tag}>`).join(' > ')}`);
                console.log(`    跳过检测:`);
                console.log(`      - inPre: ${node.wouldSkip?.inPre}`);
                console.log(`      - inCode: ${node.wouldSkip?.inCode}`);
                console.log(`      - inCodeBlock: ${node.wouldSkip?.inCodeBlock}`);
                console.log(`      - inMermaid: ${node.wouldSkip?.inMermaid}`);
                console.log(`      - inKatex: ${node.wouldSkip?.inKatex}`);
                console.log(`    *** 会被跳过: ${node.shouldSkip ? '是 ❌' : '否 ✅'} ***`);
            });
        } else {
            console.log('  ⚠️ 未在内容区域内找到公式文本节点！');
            console.log('  可能原因: 选择器覆盖不全，或公式在选择器范围外');
        }

        console.log('\n【6. 手动渲染测试】');
        if (result.manualRenderTest?.ok) {
            console.log('  ✅ KaTeX 手动渲染成功');
            console.log(`  HTML 长度: ${result.manualRenderTest.htmlLength}`);
        } else {
            console.log('  ❌ KaTeX 手动渲染失败:', result.manualRenderTest?.error);
        }

        console.log('\n' + '='.repeat(60));
        console.log('诊断结论');
        console.log('='.repeat(60));

        const hasFormulas = result.dollarDollarInPage > 0;
        const hasKatex = result.environment?.hasKatex;
        const foundTextNodes = result.mathTextNodes?.length > 0;
        const allSkipped = foundTextNodes && result.mathTextNodes.every(n => n.shouldSkip);
        const hasMarked = result.markedElements?.length > 0;
        const hasRendered = result.katexNodes > 0;

        if (!hasFormulas) {
            console.log('❓ 页面中未检测到 $$ 公式');
        } else if (!hasKatex) {
            console.log('❌ KaTeX 库未加载');
        } else if (!foundTextNodes) {
            console.log('❌ 公式文本不在 CONTENT_SELECTOR 选择器范围内');
            console.log('   → 需要检查/扩大选择器范围');
        } else if (allSkipped) {
            console.log('❌ 所有公式文本节点都被 shouldSkipTextNode 跳过');
            console.log('   → 需要修改跳过逻辑，排除公式所在的结构');
        } else if (hasMarked && !hasRendered) {
            console.log('❌ 元素已被标记但未渲染成功');
            console.log('   → 可能是时机问题或 replaceWith 失败');
        } else if (!hasMarked) {
            console.log('❌ 元素未被标记，renderMath 可能未被调用');
            console.log('   → 需要检查 scan.js 的调用逻辑');
        } else {
            console.log('需要进一步分析...');
        }

    } catch (err) {
        console.error('[错误]', err.message);
    }
}

main().catch(console.error);
