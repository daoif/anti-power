/**
 * 调试 Manager 窗口代码块 DOM 结构
 *
 * 用于诊断语言标识符位置问题
 *
 * 使用方法:
 * 1. 启动 Antigravity: Antigravity.exe --remote-debugging-port=9222
 * 2. 打开 Manager 窗口, 让 AI 生成包含代码块的回复
 * 3. 运行: node scripts/dump-codeblock-dom.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('[INFO] Fetching WebSocket URL...');

    let wsUrl;
    try {
        const response = await fetch('http://127.0.0.1:9222/json/version');
        const info = await response.json();
        wsUrl = info.webSocketDebuggerUrl;
    } catch (err) {
        console.error('[ERROR] Failed to fetch WebSocket URL:', err?.message || err);
        console.log('\nPlease ensure Antigravity is running with:');
        console.log('  Antigravity.exe --remote-debugging-port=9222');
        process.exit(1);
    }

    console.log('[INFO] WebSocket URL:', wsUrl);

    const browser = await chromium.connectOverCDP(wsUrl);
    const contexts = browser.contexts();
    let managerPage = null;

    for (const context of contexts) {
        for (const page of context.pages()) {
            const title = await page.title().catch(() => '');
            const url = page.url();
            if (title === 'Manager' || url.includes('workbench-jetski-agent.html')) {
                managerPage = page;
                console.log(`[INFO] Found Manager: ${title || url}`);
                break;
            }
        }
        if (managerPage) break;
    }

    if (!managerPage) {
        console.error('[ERROR] Manager window not found. Please open it first.');
        await browser.close();
        process.exit(1);
    }

    console.log('[INFO] Extracting code block DOM structures...\n');

    const result = await managerPage.evaluate(() => {
        const getClassString = (el) => {
            if (!el) return '';
            const cn = el.className;
            if (typeof cn === 'string') return cn;
            if (cn && typeof cn.baseVal === 'string') return cn.baseVal;
            return '';
        };

        // Helper to get element info
        const getElementInfo = (el, depth = 0) => {
            if (!el || depth > 10) return null;
            const info = {
                tag: el.tagName?.toLowerCase() || '#text',
                class: getClassString(el) || undefined,
                id: el.id || undefined,
            };
            // Check for language-xxx
            if (info.class) {
                const langMatch = info.class.match(/language-(\w+)/);
                if (langMatch) {
                    info.langFound = langMatch[1];
                }
            }
            return info;
        };

        // Get ancestors chain
        const getAncestors = (el, levels = 5) => {
            const chain = [];
            let current = el.parentElement;
            for (let i = 0; i < levels && current; i++) {
                chain.push(getElementInfo(current));
                current = current.parentElement;
            }
            return chain;
        };

        // Get immediate children info
        const getChildren = (el, maxDepth = 3, currentDepth = 0) => {
            if (!el || currentDepth >= maxDepth) return [];
            const children = [];
            for (const child of el.children) {
                const info = getElementInfo(child);
                if (info) {
                    info.children = getChildren(child, maxDepth, currentDepth + 1);
                    children.push(info);
                }
            }
            return children;
        };

        // Find all PRE elements (code blocks)
        const preElements = document.querySelectorAll('pre');
        const codeBlocks = [];

        preElements.forEach((pre, idx) => {
            const classStr = getClassString(pre);
            // Skip inline code
            if (classStr.includes('inline')) return;

            const isInList = !!pre.closest('li');
            const listInfo = isInList ? {
                listTag: pre.closest('ol, ul')?.tagName?.toLowerCase(),
                liClass: getClassString(pre.closest('li')),
                // Check if PRE is direct child of LI
                isDirectChildOfLi: pre.parentElement?.tagName === 'LI',
                // Get path from LI to PRE
                pathFromLi: (() => {
                    const path = [];
                    let current = pre;
                    const li = pre.closest('li');
                    while (current && current !== li) {
                        path.unshift(getElementInfo(current));
                        current = current.parentElement;
                    }
                    return path;
                })(),
            } : null;

            // Find language identifier
            let langSource = null;
            let langValue = null;

            // Check 1: Current element class
            const preLangMatch = classStr.match(/language-(\w+)/);
            if (preLangMatch) {
                langSource = 'pre.class';
                langValue = preLangMatch[1];
            }

            // Check 2: Child elements
            if (!langValue) {
                const langChild = pre.querySelector('[class*="language-"]');
                if (langChild) {
                    const childClass = getClassString(langChild);
                    const match = childClass.match(/language-(\w+)/);
                    if (match) {
                        langSource = 'child.' + langChild.tagName.toLowerCase();
                        langValue = match[1];
                    }
                }
            }

            // Check 3: Parent element
            if (!langValue && pre.parentElement) {
                const parentClass = getClassString(pre.parentElement);
                const match = parentClass.match(/language-(\w+)/);
                if (match) {
                    langSource = 'parent.' + pre.parentElement.tagName.toLowerCase();
                    langValue = match[1];
                }
            }

            // Check 4: Sibling elements (font-sans for language label)
            if (!langValue) {
                const fontSans = pre.querySelector('.font-sans');
                if (fontSans) {
                    const text = fontSans.textContent?.trim().toLowerCase();
                    if (text && text.length < 20) {
                        langSource = 'font-sans.text';
                        langValue = text;
                    }
                }
            }

            // Get code content preview
            const codeBlock = pre.querySelector('.code-block');
            const lines = pre.querySelectorAll('.line-content');
            let codePreview = '';
            if (lines.length > 0) {
                codePreview = Array.from(lines).slice(0, 2).map(l => l.textContent).join('\n');
            } else if (codeBlock) {
                codePreview = codeBlock.textContent?.slice(0, 100) || '';
            } else {
                codePreview = pre.textContent?.slice(0, 100) || '';
            }

            codeBlocks.push({
                index: idx,
                isInList,
                listInfo,
                pre: {
                    class: classStr || '(no class)',
                    children: getChildren(pre, 4),
                },
                ancestors: getAncestors(pre, 4),
                langFound: langValue ? { source: langSource, value: langValue } : null,
                codePreview: codePreview.slice(0, 80),
                lineCount: lines.length,
            });
        });

        // Also check for div-based code blocks
        const divCodeBlocks = document.querySelectorAll('div[class*="language-"]');
        const divBlocks = [];

        divCodeBlocks.forEach((div, idx) => {
            const classStr = getClassString(div);
            const langMatch = classStr.match(/language-(\w+)/);
            const isInList = !!div.closest('li');

            divBlocks.push({
                index: idx,
                isInList,
                class: classStr,
                langFound: langMatch ? langMatch[1] : null,
                tag: 'div',
                ancestors: getAncestors(div, 3),
            });
        });

        return {
            totalPreElements: preElements.length,
            codeBlocks,
            divCodeBlocks: divBlocks,
            summary: {
                inList: codeBlocks.filter(b => b.isInList).length,
                notInList: codeBlocks.filter(b => !b.isInList).length,
                withLang: codeBlocks.filter(b => b.langFound).length,
                withoutLang: codeBlocks.filter(b => !b.langFound).length,
            },
        };
    });

    // Output results
    console.log('='.repeat(60));
    console.log('CODE BLOCK DOM STRUCTURE ANALYSIS');
    console.log('='.repeat(60));

    console.log(`\nTotal PRE elements: ${result.totalPreElements}`);
    console.log(`Code blocks analyzed: ${result.codeBlocks.length}`);
    console.log(`  - In list: ${result.summary.inList}`);
    console.log(`  - Not in list: ${result.summary.notInList}`);
    console.log(`  - With language: ${result.summary.withLang}`);
    console.log(`  - Without language: ${result.summary.withoutLang}`);

    if (result.divCodeBlocks.length > 0) {
        console.log(`\nDiv-based code blocks: ${result.divCodeBlocks.length}`);
    }

    console.log('\n' + '-'.repeat(60));
    console.log('DETAILED CODE BLOCK INFO');
    console.log('-'.repeat(60));

    result.codeBlocks.forEach((block, i) => {
        console.log(`\n[Block ${i}]${block.isInList ? ' (IN LIST)' : ''}`);
        console.log(`  PRE class: ${block.pre.class}`);
        console.log(`  Language found: ${block.langFound ? `${block.langFound.value} (from ${block.langFound.source})` : 'NONE'}`);
        console.log(`  Lines: ${block.lineCount}`);
        console.log(`  Code preview: ${block.codePreview.slice(0, 50)}...`);

        if (block.isInList && block.listInfo) {
            console.log(`  List type: ${block.listInfo.listTag}`);
            console.log(`  Direct child of LI: ${block.listInfo.isDirectChildOfLi}`);
            if (block.listInfo.pathFromLi.length > 1) {
                console.log(`  Path from LI: ${block.listInfo.pathFromLi.map(p => p.tag + (p.class ? '.' + p.class.split(' ')[0] : '')).join(' > ')}`);
            }
        }

        console.log('  PRE children structure:');
        const printChildren = (children, indent = '    ') => {
            children.forEach(child => {
                let desc = child.tag;
                if (child.class) {
                    const shortClass = child.class.split(' ').slice(0, 3).join(' ');
                    desc += `.${shortClass}`;
                }
                if (child.langFound) {
                    desc += ` [LANG: ${child.langFound}]`;
                }
                console.log(`${indent}- ${desc}`);
                if (child.children && child.children.length > 0) {
                    printChildren(child.children, indent + '  ');
                }
            });
        };
        printChildren(block.pre.children);
    });

    // Save to file
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const outputPath = path.join(tempDir, 'codeblock-dom.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`\n[INFO] Full data saved to: ${outputPath}`);

    await browser.close();
}

main().catch(err => {
    console.error('[ERROR]', err?.message || err);
    process.exit(1);
});
