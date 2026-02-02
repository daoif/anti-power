/**
 * Manager Panel 复制功能
 *
 * 本模块提供 Manager 窗口的复制按钮功能，完全独立于 cascade-panel。
 * 提取逻辑与 cascade-panel/extract.js 保持同步。
 *
 * 主要功能：
 * - 内容区域复制按钮注入
 * - 格式化内容提取（代码块、表格、列表、Mermaid、数学公式）
 * - 标题转换为 Markdown 格式
 */

import {
    BOUND_ATTR,
    BUTTON_CLASS,
    BOTTOM_BUTTON_CLASS,
    COPY_BTN_CLASS,
    MERMAID_SOURCE_PROP,
    RAW_TEXT_PROP,
    CONTENT_SELECTOR,
} from './constants.js';
import { createCopyButton, copyToClipboard, showCopySuccess } from './utils.js';

// 常见语言集合，用于过滤代码块标题等噪音文本
const COMMON_LANGS = new Set([
    'xml', 'html', 'css', 'javascript', 'typescript', 'python', 'java',
    'json', 'bash', 'shell', 'sql', 'yaml', 'markdown', 'md', 'go', 'rust',
    'c', 'cpp', 'csharp', 'php', 'ruby', 'swift', 'kotlin',
]);

// 需要跳过的标签
const SKIP_TAGS = new Set(['STYLE', 'SCRIPT', 'NOSCRIPT', 'TEMPLATE', 'SVG']);

/**
 * 获取类名字符串（兼容 SVG）
 * @param {Element} el
 * @returns {string}
 */
const getClassString = (el) => {
    if (!el) return '';
    const className = el.className;
    if (typeof className === 'string') return className;
    if (className && typeof className.baseVal === 'string') return className.baseVal;
    return '';
};

/**
 * 从 KaTeX 或 MathJax 的渲染结构中提取 LaTeX 源码
 * @param {Element} mathEl
 * @returns {string|null} 提取失败返回 null
 */
const extractLatexFromMath = (mathEl) => {
    const annotation = mathEl.querySelector('annotation[encoding="application/x-tex"]');
    if (annotation) {
        const latex = annotation.textContent;
        const isDisplay = mathEl.closest('.katex-display') !== null;
        return isDisplay ? `$$${latex}$$` : `$${latex}$`;
    }

    if (mathEl.tagName === 'MJX-CONTAINER') {
        const ariaLabel = mathEl.getAttribute('aria-label');
        if (ariaLabel) {
            const isDisplay = mathEl.getAttribute('display') === 'true' ||
                mathEl.classList.contains('MathJax_Display');
            return isDisplay ? `$$${ariaLabel}$$` : `$${ariaLabel}$`;
        }
    }

    return null;
};

/**
 * 提取列表项内容，处理内联代码和数学公式
 * 只提取列表项的直接文本内容，嵌套列表和代码块由调用方单独处理
 * @param {HTMLLIElement} li
 * @returns {string}
 */
const extractListItemContent = (li) => {
    let content = '';
    const walker = document.createTreeWalker(
        li,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
        null,
        false
    );

    let node;
    let skipUntil = null;

    while ((node = walker.nextNode())) {
        if (skipUntil && skipUntil.contains(node)) continue;
        skipUntil = null;

        if (node.nodeType === Node.ELEMENT_NODE) {
            const tag = node.tagName;
            const classString = getClassString(node);

            // 跳过嵌套列表，由调用方递归处理
            if (tag === 'OL' || tag === 'UL') {
                skipUntil = node;
                continue;
            }

            // PRE 标签处理：pre.inline 视为内联代码，其他 PRE 由调用方单独处理
            if (tag === 'PRE') {
                if (classString.includes('inline')) {
                    const code = node.querySelector('code');
                    content += `\`${code ? code.textContent : node.textContent}\``;
                }
                skipUntil = node;
                continue;
            }
            if (classString.includes('language-') || classString.includes('code-block')) {
                skipUntil = node;
                continue;
            }

            // 跳过复制按钮
            if (classString.includes(BUTTON_CLASS) || classString.includes('manager-copy-btn')) {
                skipUntil = node;
                continue;
            }

            // 处理内联代码（非代码块内的 code 标签）
            if (tag === 'CODE' && !node.closest('pre')) {
                content += `\`${node.textContent}\``;
                skipUntil = node;
                continue;
            }

            // 处理 KaTeX 公式
            if (node.classList.contains('katex')) {
                const latex = extractLatexFromMath(node);
                if (latex) {
                    content += latex;
                    skipUntil = node;
                    continue;
                }
            }
        } else if (node.nodeType === Node.TEXT_NODE) {
            const parent = node.parentElement;
            // 跳过已处理的内联代码和公式内部文本
            if (parent && parent.closest('code, .katex, mjx-container')) continue;
            // 跳过代码块内部文本
            if (parent && parent.closest('pre, .code-block, [class*="language-"]')) continue;
            // 跳过复制按钮内部文本
            if (parent && parent.closest(`.${BUTTON_CLASS}, .manager-copy-btn`)) continue;
            content += node.textContent;
        }
    }

    return content.trim().replace(/\n+/g, ' ');
};

/**
 * 提取代码块内容
 * @param {Element} codeBlockContainer - 包含代码块的容器
 * @returns {string} Markdown 格式的代码块
 */
const extractCodeBlockContent = (codeBlockContainer) => {
    // 尝试从当前元素获取语言标识
    let classString = getClassString(codeBlockContainer);
    let langMatch = classString.match(/language-(\w+)/);

    // 如果当前元素没有语言标识，尝试从子元素查找
    if (!langMatch) {
        const langEl = codeBlockContainer.querySelector('[class*="language-"]');
        if (langEl) {
            const langElClass = getClassString(langEl);
            langMatch = langElClass.match(/language-(\w+)/);
        }
    }

    // 如果还没找到，尝试从父级查找
    if (!langMatch && codeBlockContainer.parentElement) {
        const parentClass = getClassString(codeBlockContainer.parentElement);
        langMatch = parentClass.match(/language-(\w+)/);
    }

    const lang = langMatch ? langMatch[1] : '';

    const codeBlock = codeBlockContainer.querySelector('.code-block') || codeBlockContainer;
    const lines = codeBlock.querySelectorAll('.line-content');

    let codeContent = '';
    if (lines.length > 0) {
        lines.forEach((line, idx) => {
            codeContent += line.textContent;
            if (idx < lines.length - 1) codeContent += '\n';
        });
    } else {
        codeContent = codeBlock.textContent || '';
    }

    const fence = lang ? `\`\`\`${lang}` : '```';
    return `${fence}\n${codeContent.trimEnd()}\n\`\`\``;
};

/**
 * 将有序列表节点转换为 Markdown 格式（支持嵌套）
 * @param {HTMLOListElement} olEl
 * @param {number} depth - 嵌套深度
 * @returns {string}
 */
const extractOrderedList = (olEl, depth = 0) => {
    let markdown = '\n';
    const startNum = parseInt(olEl.getAttribute('start'), 10) || 1;
    const items = olEl.querySelectorAll(':scope > li');
    const indent = '   '.repeat(depth); // 3 spaces per depth level

    items.forEach((li, idx) => {
        const num = startNum + idx;
        const content = extractListItemContent(li);
        markdown += `${indent}${num}. ${content}\n`;

        // 处理列表项内的代码块（排除 pre.inline）
        // 搜索当前 li 下的所有代码块，但跳过属于嵌套 li 的
        const codeBlocks = li.querySelectorAll('pre:not(.inline), div[class*="language-"]');
        codeBlocks.forEach((block) => {
            // 跳过嵌套列表中的代码块（由递归处理）
            const closestLi = block.closest('li');
            if (closestLi !== li) return;
            const codeMarkdown = extractCodeBlockContent(block);
            // 代码块需要缩进以保持在列表项内
            const indentedCode = codeMarkdown.split('\n').map(line => indent + '   ' + line).join('\n');
            markdown += indentedCode + '\n';
        });

        // 递归处理嵌套列表
        const nestedLists = li.querySelectorAll(':scope > ol, :scope > ul');
        nestedLists.forEach((nested) => {
            if (nested.tagName === 'OL') {
                markdown += extractOrderedList(nested, depth + 1);
            } else {
                markdown += extractUnorderedList(nested, depth + 1);
            }
        });
    });

    return markdown;
};

/**
 * 将无序列表节点转换为 Markdown 格式（支持嵌套）
 * @param {HTMLUListElement} ulEl
 * @param {number} depth - 嵌套深度
 * @returns {string}
 */
const extractUnorderedList = (ulEl, depth = 0) => {
    let markdown = '\n';
    const items = ulEl.querySelectorAll(':scope > li');
    const indent = '   '.repeat(depth); // 3 spaces per depth level

    items.forEach((li) => {
        const content = extractListItemContent(li);
        markdown += `${indent}- ${content}\n`;

        // 处理列表项内的代码块（排除 pre.inline）
        // 搜索当前 li 下的所有代码块，但跳过属于嵌套 li 的
        const codeBlocks = li.querySelectorAll('pre:not(.inline), div[class*="language-"]');
        codeBlocks.forEach((block) => {
            // 跳过嵌套列表中的代码块（由递归处理）
            const closestLi = block.closest('li');
            if (closestLi !== li) return;
            const codeMarkdown = extractCodeBlockContent(block);
            // 代码块需要缩进以保持在列表项内
            const indentedCode = codeMarkdown.split('\n').map(line => indent + '   ' + line).join('\n');
            markdown += indentedCode + '\n';
        });

        // 递归处理嵌套列表
        const nestedLists = li.querySelectorAll(':scope > ol, :scope > ul');
        nestedLists.forEach((nested) => {
            if (nested.tagName === 'OL') {
                markdown += extractOrderedList(nested, depth + 1);
            } else {
                markdown += extractUnorderedList(nested, depth + 1);
            }
        });
    });

    return markdown;
};

/**
 * 将表格节点转换为 Markdown 表格字符串
 * @param {HTMLTableElement} tableEl
 * @returns {string}
 */
const extractTable = (tableEl) => {
    let markdown = '';
    const rows = tableEl.querySelectorAll('tr');

    rows.forEach((row, rowIdx) => {
        const cells = row.querySelectorAll('th, td');
        const cellContents = [];

        cells.forEach((cell) => {
            let cellText = cell.textContent || '';
            cellText = cellText.trim().replace(/\n/g, ' ').replace(/\|/g, '\\|');
            cellContents.push(cellText);
        });

        markdown += '| ' + cellContents.join(' | ') + ' |\n';

        if (rowIdx === 0 && row.querySelector('th')) {
            markdown += '| ' + cellContents.map(() => '---').join(' | ') + ' |\n';
        }
    });

    return markdown;
};

/**
 * 提取格式化内容（代码块、表格、数学公式、Mermaid、列表等）
 * @param {HTMLElement} el
 * @returns {string}
 */
const extractFormattedText = (el) => {
    if (!el) return '';

    const hasCodeBlock = el.querySelector(
        '[class*="language-"], .code-block, [aria-label^="highlighted-code"], pre'
    );
    const hasTable = el.querySelector('table');
    const hasMermaid = el.querySelector('.manager-mermaid-container');
    const hasList = el.querySelector('ol, ul');
    const hasMath = el.querySelector('.katex, mjx-container');
    const hasHeading = el.querySelector('h1, h2, h3, h4, h5, h6');

    // 仅当没有任何需要特殊处理的结构时才使用缓存的原始文本
    if (!hasCodeBlock && !hasTable && !hasMermaid && !hasList && !hasMath && !hasHeading) {
        if (el[RAW_TEXT_PROP] !== undefined) {
            return String(el[RAW_TEXT_PROP]).trim();
        }
    }

    let result = '';
    const walker = document.createTreeWalker(
        el,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
        null,
        false
    );

    let currentNode;
    let skipUntilEndOfBlock = null;

    while ((currentNode = walker.nextNode())) {
        // 跳过已处理块级节点的内部子树
        if (skipUntilEndOfBlock && skipUntilEndOfBlock.contains(currentNode)) {
            continue;
        }
        skipUntilEndOfBlock = null;

        if (currentNode.nodeType === Node.ELEMENT_NODE) {
            const classString = getClassString(currentNode);

            // 跳过 STYLE/SCRIPT 等标签
            if (SKIP_TAGS.has(currentNode.tagName)) {
                skipUntilEndOfBlock = currentNode;
                continue;
            }

            // 标题处理：转换为 Markdown # 格式
            const headingMatch = currentNode.tagName.match(/^H([1-6])$/);
            if (headingMatch) {
                const level = parseInt(headingMatch[1], 10);
                const prefix = '#'.repeat(level);
                const headingText = currentNode.textContent.trim();
                result += `\n${prefix} ${headingText}\n`;
                skipUntilEndOfBlock = currentNode;
                continue;
            }

            // 公式处理：优先从渲染 DOM 中恢复 LaTeX
            if (classString.includes('katex') && !classString.includes('katex-display')) {
                if (currentNode.classList.contains('katex')) {
                    const latex = extractLatexFromMath(currentNode);
                    if (latex) {
                        result += latex;
                        skipUntilEndOfBlock = currentNode;
                        continue;
                    }
                }
            }

            if (classString.includes('katex-display')) {
                const katexEl = currentNode.querySelector('.katex') || currentNode;
                const latex = extractLatexFromMath(katexEl);
                if (latex) {
                    result += `\n${latex}\n`;
                    skipUntilEndOfBlock = currentNode;
                    continue;
                }
            }

            if (currentNode.tagName === 'MJX-CONTAINER') {
                const latex = extractLatexFromMath(currentNode);
                if (latex) {
                    const isDisplay = currentNode.getAttribute('display') === 'true';
                    result += isDisplay ? `\n${latex}\n` : latex;
                    skipUntilEndOfBlock = currentNode;
                    continue;
                }
            }

            // Mermaid 容器：恢复源码
            if (classString.includes('manager-mermaid-container')) {
                const source = currentNode[MERMAID_SOURCE_PROP];
                if (source) {
                    result += `\n\`\`\`mermaid\n${source}\n\`\`\`\n`;
                }
                skipUntilEndOfBlock = currentNode;
                continue;
            }

            if (currentNode.tagName === 'TABLE') {
                result += `\n${extractTable(currentNode)}\n`;
                skipUntilEndOfBlock = currentNode;
                continue;
            }

            // 有序列表处理
            if (currentNode.tagName === 'OL') {
                result += extractOrderedList(currentNode);
                skipUntilEndOfBlock = currentNode;
                continue;
            }

            // 无序列表处理
            if (currentNode.tagName === 'UL') {
                result += extractUnorderedList(currentNode);
                skipUntilEndOfBlock = currentNode;
                continue;
            }

            // 代码块：通过 language-xxx 类匹配（优先）
            const langMatch = classString.match(/language-(\w+)/);
            if (langMatch) {
                const lang = langMatch[1];
                const codeBlock = currentNode.querySelector('.code-block');
                if (codeBlock) {
                    const lines = codeBlock.querySelectorAll('.line-content');
                    let codeContent = '';
                    lines.forEach((line, idx) => {
                        codeContent += line.textContent;
                        if (idx < lines.length - 1) codeContent += '\n';
                    });
                    result += `\n\`\`\`${lang}\n${codeContent}\n\`\`\`\n`;
                    skipUntilEndOfBlock = currentNode;
                    continue;
                }
            }

            // PRE 标签处理：如果子元素有 language-xxx，跳过让递归处理
            if (currentNode.tagName === 'PRE') {
                // 检查子元素是否有 language-xxx 类
                const hasLangChild = currentNode.querySelector('[class*="language-"]');
                if (hasLangChild) {
                    // 不截断，让 TreeWalker 继续进入子元素
                    continue;
                }
                // 无语言标识的代码块
                const codeBlock = currentNode.querySelector('.code-block');
                if (codeBlock) {
                    const lines = codeBlock.querySelectorAll('.line-content');
                    let codeContent = '';
                    if (lines.length > 0) {
                        lines.forEach((line, idx) => {
                            codeContent += line.textContent;
                            if (idx < lines.length - 1) codeContent += '\n';
                        });
                    } else {
                        codeContent = codeBlock.textContent || '';
                    }
                    result += `\n\`\`\`\n${codeContent.trimEnd()}\n\`\`\`\n`;
                    skipUntilEndOfBlock = currentNode;
                    continue;
                }
            }

            // .code-block 兜底（无语言标识）
            if (classString.includes('code-block')) {
                const lines = currentNode.querySelectorAll('.line-content');
                let codeContent = '';
                if (lines.length > 0) {
                    lines.forEach((line, idx) => {
                        codeContent += line.textContent;
                        if (idx < lines.length - 1) codeContent += '\n';
                    });
                } else {
                    codeContent = currentNode.textContent || '';
                }
                result += `\n\`\`\`\n${codeContent.trimEnd()}\n\`\`\`\n`;
                skipUntilEndOfBlock = currentNode;
                continue;
            }

            const ariaLabel = currentNode.getAttribute('aria-label') || '';
            if (ariaLabel.startsWith('highlighted-code') && !langMatch) {
                const codeBlock = currentNode.querySelector('.code-block');
                if (codeBlock) {
                    const lines = codeBlock.querySelectorAll('.line-content');
                    let codeContent = '';
                    lines.forEach((line, idx) => {
                        codeContent += line.textContent;
                        if (idx < lines.length - 1) codeContent += '\n';
                    });
                    result += `\n\`\`\`\n${codeContent}\n\`\`\`\n`;
                    skipUntilEndOfBlock = currentNode;
                }
            }
        } else if (currentNode.nodeType === Node.TEXT_NODE) {
            const parent = currentNode.parentElement;
            if (parent) {
                // 跳过渲染器内部文本
                if (parent.closest('.katex, mjx-container, .MathJax, .manager-mermaid-container')) {
                    continue;
                }
                if (parent.closest('[class*="language-"]')) {
                    continue;
                }
                if (parent.closest('.code-block, pre')) {
                    continue;
                }

                const parentClassStr = getClassString(parent);
                if (
                    parentClassStr.includes('opacity-60') &&
                    parent.closest('pre')?.previousElementSibling
                ) {
                    continue;
                }

                const textContent = currentNode.textContent.trim().toLowerCase();
                if (
                    COMMON_LANGS.has(textContent) &&
                    parent.closest('pre')?.parentElement?.querySelector('[class*="language-"]')
                ) {
                    continue;
                }

                // 跳过复制按钮内部文本
                if (parent.closest(`.${BUTTON_CLASS}, .manager-copy-btn, .manager-feedback-copy`)) {
                    continue;
                }
            }
            result += currentNode.textContent;
        }
    }

    // 去除所有空行，优化 Markdown 格式
    return result
        .split('\n')
        .filter(line => line.trim() !== '')
        .join('\n')
        .trim();
};

/**
 * 获取配置（从全局变量读取）
 * @returns {Object}
 */
const getConfig = () => {
    return window.__MANAGER_CONFIG__ || {};
};

/**
 * 绑定智能感应事件（鼠标在按钮附近才显示）
 * @param {HTMLElement} contentEl - 内容容器
 * @param {HTMLElement} topBtn - 右上角按钮
 * @param {HTMLElement} bottomBtn - 右下角按钮（可选）
 */
const bindSmartHover = (contentEl, topBtn, bottomBtn) => {
    contentEl.addEventListener('mousemove', (e) => {
        const rect = contentEl.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // 右上角区域：右侧 120px, 顶部 60px
        if (x > rect.width - 120 && y < 60) {
            topBtn.classList.add('manager-copy-button-visible');
        } else {
            topBtn.classList.remove('manager-copy-button-visible');
        }

        // 右下角区域：右侧 120px, 底部 60px
        if (bottomBtn) {
            if (x > rect.width - 120 && y > rect.height - 60) {
                bottomBtn.classList.add('manager-copy-button-visible');
            } else {
                bottomBtn.classList.remove('manager-copy-button-visible');
            }
        }
    });

    contentEl.addEventListener('mouseleave', () => {
        topBtn.classList.remove('manager-copy-button-visible');
        if (bottomBtn) {
            bottomBtn.classList.remove('manager-copy-button-visible');
        }
    });
};

/**
 * 为内容区添加复制按钮
 * @param {HTMLElement} contentEl
 */
export const ensureContentCopyButton = (contentEl) => {
    if (!contentEl || contentEl.getAttribute(BOUND_ATTR) === '1') return;

    if (contentEl[RAW_TEXT_PROP] === undefined) {
        const raw = contentEl.innerText !== undefined
            ? contentEl.innerText
            : contentEl.textContent || '';
        contentEl[RAW_TEXT_PROP] = raw;
    }

    contentEl.setAttribute(BOUND_ATTR, '1');

    // 确保容器有相对定位
    const style = window.getComputedStyle(contentEl);
    if (style.position === 'static') {
        contentEl.style.position = 'relative';
    }

    const config = getConfig();
    const smartHover = config.copyButtonSmartHover || false;
    const bottomPosition = config.copyButtonShowBottom || 'float';

    // 右上角悬停按钮
    const btn = createCopyButton(`${COPY_BTN_CLASS} ${BUTTON_CLASS}`, 'top');
    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const text = extractFormattedText(contentEl);
        const success = await copyToClipboard(text);
        if (success) showCopySuccess(btn);
    });
    contentEl.appendChild(btn);

    // 右下角悬停按钮（悬浮模式）
    let bottomBtn = null;
    if (bottomPosition === 'float') {
        bottomBtn = createCopyButton(`${COPY_BTN_CLASS} ${BOTTOM_BUTTON_CLASS}`, 'bottom');
        bottomBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const text = extractFormattedText(contentEl);
            const success = await copyToClipboard(text);
            if (success) showCopySuccess(bottomBtn);
        });
        contentEl.appendChild(bottomBtn);
    }

    // 如果启用智能感应，添加类名并绑定 mousemove 事件
    if (smartHover) {
        contentEl.classList.add('smart-hover');
        bindSmartHover(contentEl, btn, bottomBtn);
    }
};

/**
 * 为反馈区域添加复制按钮（Good/Bad 按钮旁边）
 */
export const addFeedbackCopyButtons = () => {
    const feedbackContainers = document.querySelectorAll('[data-tooltip-id^="up-"]');

    feedbackContainers.forEach((goodBtn) => {
        const parent = goodBtn.parentElement;
        if (!parent || parent.querySelector('.manager-feedback-copy')) return;

        // 找到对应的内容区
        let contentEls = null;
        let node = parent;
        for (let i = 0; i < 20 && node; i++) {
            const candidates = node.querySelectorAll && node.querySelectorAll(CONTENT_SELECTOR);
            if (candidates && candidates.length > 0) {
                // 简单的可见性检查：offsetParent 不为 null
                const visible = Array.from(candidates).filter((el) => el.offsetParent !== null);
                contentEls = visible.length > 0 ? visible : Array.from(candidates);
                break;
            }
            node = node.parentElement;
        }
        if (!contentEls || contentEls.length === 0) return;

        const btn = createCopyButton(`${COPY_BTN_CLASS} manager-feedback-copy`, 'bottom');
        btn.style.marginRight = '0.5rem';
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const text = contentEls
                .map((el) => extractFormattedText(el))
                .filter((part) => part && part.trim())
                .join('\n\n');
            const success = await copyToClipboard(text);
            if (success) showCopySuccess(btn);
        });

        parent.insertBefore(btn, goodBtn);
    });
};
