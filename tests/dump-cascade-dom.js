/**
 * Extract sidebar messages from React elements in the virtualized list
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function findCascadeFrame(page) {
    async function searchFrame(frame) {
        try {
            const hasCascade = await frame.evaluate(() => {
                return document.getElementById('react-app') !== null ||
                    document.getElementById('chat') !== null;
            });
            if (hasCascade) return frame;
            for (const child of frame.childFrames()) {
                const result = await searchFrame(child);
                if (result) return result;
            }
        } catch (e) { }
        return null;
    }
    return searchFrame(page.mainFrame());
}

async function main() {
    const wsUrl = process.argv[2];
    if (!wsUrl) {
        console.log('❌ 请提供 WebSocket URL 作为参数！');
        process.exit(1);
    }

    console.log(`🔗 正在连接到: ${wsUrl}\n`);

    try {
        const browser = await chromium.connectOverCDP(wsUrl);
        console.log('✅ 成功连接!\n');

        const contexts = browser.contexts();
        let cascadeFrame = null;

        for (const context of contexts) {
            for (const page of context.pages()) {
                const title = await page.title();
                if (title !== 'Manager' && title !== 'Launchpad') {
                    cascadeFrame = await findCascadeFrame(page);
                    if (cascadeFrame) {
                        console.log('🎯 找到侧边栏 frame!\n');
                        break;
                    }
                }
            }
            if (cascadeFrame) break;
        }

        if (!cascadeFrame) {
            console.log('❌ 未找到侧边栏 frame');
            await browser.close();
            process.exit(1);
        }

        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        console.log('🔍 从 React 元素中递归提取消息...\n');

        const analysis = await cascadeFrame.evaluate(() => {
            const result = {
                extractedMessages: [],
                reactElementProps: [],
            };

            const extractFromReactElement = (el, depth = 0) => {
                if (!el || depth > 20) return [];
                const items = [];

                if (el && typeof el === 'object') {
                    if (el.$$typeof || el.type) {
                        if (el.props) {
                            const props = el.props;

                            if (props.message || props.content || props.text || props.parts) {
                                items.push({
                                    depth,
                                    type: 'direct',
                                    content: props.message || props.content || props.text,
                                    parts: props.parts,
                                });
                            }

                            if (props.item && typeof props.item === 'object') {
                                items.push({
                                    depth,
                                    type: 'item',
                                    item: props.item,
                                });
                            }

                            if (props.children) {
                                if (Array.isArray(props.children)) {
                                    for (const child of props.children) {
                                        items.push(...extractFromReactElement(child, depth + 1));
                                    }
                                } else {
                                    items.push(...extractFromReactElement(props.children, depth + 1));
                                }
                            }

                            // Look for nested React elements in other props
                            for (const key of Object.keys(props)) {
                                if (key !== 'children' && key !== 'item') {
                                    const val = props[key];
                                    if (val && typeof val === 'object' && val.$$typeof) {
                                        items.push(...extractFromReactElement(val, depth + 1));
                                    }
                                }
                            }
                        }
                    }

                    if (Array.isArray(el)) {
                        for (const item of el) {
                            items.push(...extractFromReactElement(item, depth + 1));
                        }
                    }
                }

                return items;
            };

            // Use the virtual list's gap container to find its React fiber
            const gapContainer = document.querySelector('[class*="gap-y-3"][class*="px-4"]');
            if (gapContainer) {
                const fiberKey = Object.keys(gapContainer).find(k =>
                    k.startsWith('__reactFiber$')
                );

                if (fiberKey) {
                    let fiber = gapContainer[fiberKey];

                    // Walk up the fiber tree to find the first array of rendered children
                    for (let i = 0; i < 30 && fiber; i++) {
                        if (fiber.memoizedProps && fiber.memoizedProps.children) {
                            const children = fiber.memoizedProps.children;
                            if (Array.isArray(children)) {
                                result.reactElementProps.push({
                                    depth: i,
                                    childrenCount: children.length,
                                });

                                for (let j = 0; j < children.length; j++) {
                                    const child = children[j];
                                    if (child && child.props) {
                                        const props = child.props;
                                        const propKeys = Object.keys(props);

                                        result.extractedMessages.push({
                                            index: j,
                                            propKeys: propKeys.slice(0, 15),
                                            hasItem: !!props.item,
                                            itemData: props.item ? JSON.stringify(props.item, (k, v) => {
                                                if (typeof v === 'function') return '[fn]';
                                                if (typeof v === 'bigint') return v.toString();
                                                if (typeof v === 'string' && v.length > 500) return v.slice(0, 500) + '...';
                                                if (v && typeof v === 'object' && v.$$typeof) return '[ReactEl]';
                                                return v;
                                            }, 2).slice(0, 5000) : null,

                                            otherData: propKeys
                                                .filter(k => k !== 'children' && k !== 'item')
                                                .reduce((acc, k) => {
                                                    const v = props[k];
                                                    if (v && typeof v === 'object' && !v.$$typeof) {
                                                        acc[k] = v;
                                                    } else if (typeof v !== 'function') {
                                                        acc[k] = v;
                                                    }
                                                    return acc;
                                                }, {}),
                                        });
                                    }
                                }
                                break;
                            }
                        }
                        fiber = fiber.return;
                    }
                }
            }

            return result;
        });

        const analysisPath = path.join(tempDir, 'cascade-extracted.json');
        fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2), 'utf-8');
        console.log(`✅ 分析结果已保存到: ${analysisPath}`);

        console.log('\n🎯 提取的消息数据:');
        if (analysis.extractedMessages.length === 0) {
            console.log('   (无)');
        } else {
            analysis.extractedMessages.forEach((msg, i) => {
                console.log(`\n   === 消息 ${i + 1} ===`);
                console.log(`   propKeys: ${msg.propKeys.join(', ')}`);
                console.log(`   hasItem: ${msg.hasItem}`);
                if (msg.itemData) {
                    console.log(`   itemData: ${msg.itemData.slice(0, 500)}...`);
                }
                if (Object.keys(msg.otherData).length > 0) {
                    console.log(`   otherData: ${JSON.stringify(msg.otherData).slice(0, 300)}`);
                }
            });
        }

        console.log('\n🎉 分析完成!');
        await browser.close();

    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
    }
}

main();
