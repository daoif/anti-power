/**
 * Check whether DOMParser accepts Trusted Types policy output
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
    console.log('[验证] 连接 Antigravity Manager...');

    const manager = await getManagerPage();
    if (!manager) {
        console.error('[错误] 未找到 Manager 页面');
        process.exit(1);
    }

    console.log('[验证] 已连接\n');

    const testCode = `
(async function() {
    const result = {
        trustedTypesInfo: {
            supported: !!window.trustedTypes,
            hasCreatePolicy: !!window.trustedTypes?.createPolicy,
        },
        tests: [],
    };
    
    // 1. 尝试不同的方案绕过 Trusted Types
    
    // 方案 A: 使用 template 元素
    try {
        const html = '<span class="katex">测试A</span>';
        const template = document.createElement('template');
        template.innerHTML = html;  // 可能也会失败
        const fragment = template.content.cloneNode(true);
        result.tests.push({
            name: '方案A: template.innerHTML',
            ok: fragment.querySelector('.katex') !== null,
            error: null,
        });
    } catch (e) {
        result.tests.push({
            name: '方案A: template.innerHTML',
            ok: false,
            error: e.message,
        });
    }
    
    // 方案 B: 使用 Range.createContextualFragment
    try {
        const html = '<span class="katex">测试B</span>';
        const range = document.createRange();
        range.selectNode(document.body);
        const fragment = range.createContextualFragment(html);  // 可能也会失败
        result.tests.push({
            name: '方案B: Range.createContextualFragment',
            ok: fragment.querySelector('.katex') !== null,
            error: null,
        });
    } catch (e) {
        result.tests.push({
            name: '方案B: Range.createContextualFragment',
            ok: false,
            error: e.message,
        });
    }
    
    // 方案 C: 尝试创建 Trusted Types policy
    try {
        const policyNames = ['managerMath', 'dompurify', 'mermaid', 'renderCodeBlock', 'amdLoader'];
        let policy = null;
        let policyName = null;
        
        for (const name of policyNames) {
            try {
                policy = window.trustedTypes.createPolicy(name, {
                    createHTML: (html) => html,
                });
                policyName = name;
                break;
            } catch {
                // 尝试下一个
            }
        }
        
        if (policy) {
            const html = '<span class="katex">测试C</span>';
            const trustedHtml = policy.createHTML(html);
            
            const parser = new DOMParser();
            // 使用 TrustedHTML
            const doc = parser.parseFromString(trustedHtml, 'text/html');
            const fragment = document.createDocumentFragment();
            doc.body.childNodes.forEach((node) => {
                fragment.appendChild(document.importNode(node, true));
            });
            
            result.tests.push({
                name: '方案C: Trusted Types policy + DOMParser',
                ok: fragment.querySelector('.katex') !== null,
                policyName,
                error: null,
            });
        } else {
            result.tests.push({
                name: '方案C: Trusted Types policy + DOMParser',
                ok: false,
                error: '无法创建任何 policy',
            });
        }
    } catch (e) {
        result.tests.push({
            name: '方案C: Trusted Types policy + DOMParser',
            ok: false,
            error: e.message,
        });
    }
    
    // 方案 D: 手动构建 DOM 节点（不使用 innerHTML/DOMParser）
    try {
        // 模拟 KaTeX 输出的简化结构
        const span = document.createElement('span');
        span.className = 'katex';
        span.textContent = 'e^{iπ} + 1 = 0';
        
        const fragment = document.createDocumentFragment();
        fragment.appendChild(span);
        
        result.tests.push({
            name: '方案D: 手动构建 DOM 节点',
            ok: fragment.querySelector('.katex') !== null,
            error: null,
            note: '这种方式需要解析 KaTeX 的 HTML 输出并手动构建',
        });
    } catch (e) {
        result.tests.push({
            name: '方案D: 手动构建 DOM 节点',
            ok: false,
            error: e.message,
        });
    }
    
    // 方案 E: 使用已有的 policy (如果存在)
    try {
        // 检查是否有已存在的可用 policy
        // 遍历 TRUSTED_TYPES_POLICY_NAMES 中的名称
        const existingPolicyNames = ['renderCodeBlock', 'amdLoader', 'notebookRenderer'];
        let foundPolicy = null;
        let foundName = null;
        
        if (window.trustedTypes?.getPolicy) {
            for (const name of existingPolicyNames) {
                const p = window.trustedTypes.getPolicy(name);
                if (p?.createHTML) {
                    foundPolicy = p;
                    foundName = name;
                    break;
                }
            }
        }
        
        result.tests.push({
            name: '方案E: 查找已存在的 policy',
            ok: !!foundPolicy,
            policyName: foundName,
            hasGetPolicy: !!window.trustedTypes?.getPolicy,
        });
    } catch (e) {
        result.tests.push({
            name: '方案E: 查找已存在的 policy',
            ok: false,
            error: e.message,
        });
    }
    
    // 方案 F: 完整测试 - 用 policy 渲染 KaTeX
    try {
        const policyNames = ['managerMath', 'dompurify', 'mermaid', 'renderCodeBlock'];
        let policy = null;
        
        for (const name of policyNames) {
            try {
                policy = window.trustedTypes.createPolicy(name, {
                    createHTML: (html) => html,
                });
                break;
            } catch {}
        }
        
        if (policy && window.katex) {
            const latex = 'x^2 + y^2 = z^2';
            const html = window.katex.renderToString(latex, {
                displayMode: false,
                throwOnError: false,
            });
            
            const trustedHtml = policy.createHTML(html);
            const parser = new DOMParser();
            const doc = parser.parseFromString(trustedHtml, 'text/html');
            
            const testContainer = document.createElement('div');
            testContainer.style.display = 'none';
            document.body.appendChild(testContainer);
            
            doc.body.childNodes.forEach((node) => {
                testContainer.appendChild(document.importNode(node, true));
            });
            
            const hasKatexNode = testContainer.querySelector('.katex') !== null;
            const htmlPreview = testContainer.innerHTML.slice(0, 150);
            testContainer.remove();
            
            result.tests.push({
                name: '方案F: 完整 KaTeX 渲染',
                ok: hasKatexNode,
                htmlPreview,
            });
        } else {
            result.tests.push({
                name: '方案F: 完整 KaTeX 渲染',
                ok: false,
                error: !policy ? '无法创建 policy' : '无 KaTeX',
            });
        }
    } catch (e) {
        result.tests.push({
            name: '方案F: 完整 KaTeX 渲染',
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
        console.log('Trusted Types 解决方案验证报告');
        console.log('='.repeat(60));

        console.log('\n【Trusted Types 环境】');
        console.log(JSON.stringify(result.trustedTypesInfo, null, 2));

        console.log('\n【方案测试结果】');
        result.tests.forEach((test, i) => {
            const status = test.ok ? '✅ 成功' : '❌ 失败';
            console.log(`\n  ${i + 1}. ${test.name}: ${status}`);
            if (test.error) console.log(`     错误: ${test.error}`);
            if (test.policyName) console.log(`     使用的 policy: ${test.policyName}`);
            if (test.htmlPreview) console.log(`     HTML 预览: ${test.htmlPreview}...`);
            if (test.note) console.log(`     备注: ${test.note}`);
        });

        const workingSolutions = result.tests.filter(t => t.ok);
        console.log('\n' + '='.repeat(60));
        console.log('结论');
        console.log('='.repeat(60));

        if (workingSolutions.length > 0) {
            console.log('\n可行的解决方案:');
            workingSolutions.forEach(s => console.log(`  ✅ ${s.name}`));
        } else {
            console.log('\n❌ 所有方案都失败，需要进一步研究');
        }

    } catch (err) {
        console.error('[错误]', err.message);
    }
}

main().catch(console.error);
