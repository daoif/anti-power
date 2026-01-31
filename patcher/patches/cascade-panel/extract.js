/**
 * Cascade Panel 内容提取模块
 *
 * 本模块负责从 DOM 中提取格式化内容并转换为 Markdown 格式，
 * 用于复制功能。支持的内容类型包括：
 * - 代码块（带语言标识）
 * - 表格（转换为 Markdown 表格）
 * - 数学公式（恢复 LaTeX 源码）
 * - Mermaid 图表（恢复源码）
 *
 * 使用 TreeWalker 线性遍历 DOM，通过跳跃机制避免重复处理嵌套结构。
 */

import {
    BUTTON_CLASS,
    BOTTOM_BUTTON_CLASS,
    COMMON_LANGS,
    MERMAID_SOURCE_PROP,
    RAW_TEXT_PROP,
} from './constants.js';
import { getClassString } from './utils.js';

/**
 * 将表格节点转换为 Markdown 表格字符串
 * @param {HTMLTableElement} tableEl
 * @returns {string}
 * 边界：仅处理文本内容，忽略复杂单元格结构（合并单元格等）
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
 * 获取元素内的纯文本内容（用于内联格式化）
 * @param {Element} el
 * @returns {string}
 */
const getInnerText = (el) => {
    if (!el) return '';
    return el.textContent || '';
};

/**
 * 递归提取格式化内容
 * @param {Element} element - 待提取的节点
 * @param {Object} context - 上下文信息
 * @returns {string}
 */
const extractNodeContent = (element, context = {}) => {
    if (!element) return '';

    const classString = getClassString(element);
    const tagName = element.tagName;

    // 跳过不需要处理的元素
    if (['STYLE', 'SCRIPT', 'NOSCRIPT', 'TEMPLATE', 'SVG'].includes(tagName)) {
        return '';
    }

    // 跳过复制按钮
    if (
        classString.includes(BUTTON_CLASS) ||
        classString.includes(BOTTOM_BUTTON_CLASS) ||
        classString.includes('custom-copy-btn') ||
        classString.includes('cascade-copy-btn')
    ) {
        return '';
    }

    // 公式处理：优先从渲染 DOM 中恢复 LaTeX
    if (classString.includes('katex') && !classString.includes('katex-display')) {
        if (element.classList?.contains('katex')) {
            const latex = extractLatexFromMath(element);
            if (latex) return latex;
        }
    }

    if (classString.includes('katex-display')) {
        const katexEl = element.querySelector('.katex') || element;
        const latex = extractLatexFromMath(katexEl);
        if (latex) return `\n${latex}\n`;
    }

    if (tagName === 'MJX-CONTAINER') {
        const latex = extractLatexFromMath(element);
        if (latex) {
            const isDisplay = element.getAttribute('display') === 'true';
            return isDisplay ? `\n${latex}\n` : latex;
        }
    }

    // Mermaid 容器：恢复源码
    if (classString.includes('cascade-mermaid-container')) {
        const source = element[MERMAID_SOURCE_PROP];
        if (source) {
            return `\n\`\`\`mermaid\n${source}\n\`\`\`\n`;
        }
        return '';
    }

    // 表格处理
    if (tagName === 'TABLE') {
        return `\n${extractTable(element)}\n`;
    }

    // 代码块处理
    const langMatch = classString.match(/language-(\w+)/);
    if (langMatch) {
        const lang = langMatch[1];
        const codeBlock = element.querySelector('.code-block');
        if (codeBlock) {
            const lines = codeBlock.querySelectorAll('.line-content');
            let codeContent = '';
            lines.forEach((line, idx) => {
                codeContent += line.textContent;
                if (idx < lines.length - 1) codeContent += '\n';
            });
            return `\n\`\`\`${lang}\n${codeContent}\n\`\`\`\n`;
        }
    }

    const ariaLabel = element.getAttribute('aria-label') || '';
    if (ariaLabel.startsWith('highlighted-code')) {
        const codeBlock = element.querySelector('.code-block');
        if (codeBlock) {
            const lines = codeBlock.querySelectorAll('.line-content');
            let codeContent = '';
            lines.forEach((line, idx) => {
                codeContent += line.textContent;
                if (idx < lines.length - 1) codeContent += '\n';
            });
            return `\n\`\`\`\n${codeContent}\n\`\`\`\n`;
        }
    }

    // 标题处理 (H1-H6)
    if (/^H[1-6]$/.test(tagName)) {
        const level = parseInt(tagName[1], 10);
        const prefix = '#'.repeat(level);
        const content = extractChildrenContent(element, context);
        return `\n${prefix} ${content.trim()}\n`;
    }

    // 加粗处理
    if (tagName === 'STRONG' || tagName === 'B') {
        const content = extractChildrenContent(element, context);
        const trimmed = content.trim();
        if (!trimmed) return '';
        return `**${trimmed}**`;
    }

    // 斜体处理
    if (tagName === 'EM' || tagName === 'I') {
        const content = extractChildrenContent(element, context);
        const trimmed = content.trim();
        if (!trimmed) return '';
        return `*${trimmed}*`;
    }

    // 删除线处理
    if (tagName === 'DEL' || tagName === 'S' || tagName === 'STRIKE') {
        const content = extractChildrenContent(element, context);
        const trimmed = content.trim();
        if (!trimmed) return '';
        return `~~${trimmed}~~`;
    }

    // 行内代码处理
    if (tagName === 'CODE' && !element.closest('pre')) {
        const text = element.textContent || '';
        if (!text.trim()) return '';
        return `\`${text}\``;
    }

    // pre.inline 内联代码处理
    if (tagName === 'PRE' && classString.includes('inline')) {
        const code = element.querySelector('code');
        const text = code ? code.textContent : element.textContent;
        if (!text?.trim()) return '';
        return `\`${text}\``;
    }

    // 链接处理
    if (tagName === 'A') {
        const href = element.getAttribute('href') || '';
        const content = extractChildrenContent(element, context);
        const trimmed = content.trim();
        if (!trimmed) return '';
        if (href && href !== '#' && !href.startsWith('javascript:')) {
            return `[${trimmed}](${href})`;
        }
        return trimmed;
    }

    // 列表项处理
    if (tagName === 'LI') {
        const parent = element.parentElement;

        // 计算嵌套深度：统计祖先中有多少个 UL/OL
        let depth = 0;
        let ancestor = element.parentElement;
        while (ancestor) {
            if (ancestor.tagName === 'UL' || ancestor.tagName === 'OL') {
                depth++;
            }
            ancestor = ancestor.parentElement;
        }
        // depth 至少为 1（当前所在的列表），缩进层级 = depth - 1
        const indent = '  '.repeat(Math.max(0, depth - 1));

        // 分开处理：文本内容 vs 嵌套列表
        let textContent = '';
        let nestedListContent = '';

        for (const child of element.childNodes) {
            if (child.nodeType === Node.ELEMENT_NODE) {
                const childTag = child.tagName;
                if (childTag === 'UL' || childTag === 'OL') {
                    // 嵌套列表单独处理
                    nestedListContent += extractNodeContent(child, context);
                } else {
                    textContent += extractNodeContent(child, context);
                }
            } else if (child.nodeType === Node.TEXT_NODE) {
                const text = child.textContent || '';
                // 跳过渲染器内部文本等
                const parentEl = child.parentElement;
                if (parentEl?.closest('.katex, mjx-container, .MathJax, .cascade-mermaid-container')) {
                    continue;
                }
                if (parentEl?.closest('[class*="language-"]')) {
                    continue;
                }
                if (parentEl?.closest(`.${BUTTON_CLASS}`) || parentEl?.closest(`.${BOTTOM_BUTTON_CLASS}`) || parentEl?.closest('.custom-copy-btn')) {
                    continue;
                }
                textContent += text;
            }
        }

        const trimmedText = textContent.trim();
        if (!trimmedText && !nestedListContent) return '';

        // 构建列表项前缀
        let prefix;
        if (parent?.tagName === 'OL') {
            const items = Array.from(parent.children).filter(c => c.tagName === 'LI');
            const index = items.indexOf(element) + 1;
            prefix = `${indent}${index}. `;
        } else {
            prefix = `${indent}- `;
        }

        // 组合结果：文本 + 换行 + 嵌套列表
        if (nestedListContent) {
            return `${prefix}${trimmedText}\n${nestedListContent}`;
        } else {
            return `${prefix}${trimmedText}\n`;
        }
    }

    // 列表容器：嵌套列表不额外添加换行
    if (tagName === 'UL' || tagName === 'OL') {
        // 检查是否是顶级列表（父元素不是 LI）
        const isTopLevel = !element.parentElement?.closest('li');
        const content = extractChildrenContent(element, context);
        return isTopLevel ? `\n${content}` : content;
    }

    // 段落处理
    if (tagName === 'P') {
        const content = extractChildrenContent(element, context);
        const trimmed = content.trim();
        if (!trimmed) return '';
        return `\n${trimmed}\n`;
    }

    // 换行处理
    if (tagName === 'BR') {
        return '\n';
    }

    // 块引用处理
    if (tagName === 'BLOCKQUOTE') {
        const content = extractChildrenContent(element, context);
        const lines = content.trim().split('\n');
        const quoted = lines.map(line => `> ${line}`).join('\n');
        return `\n${quoted}\n`;
    }

    // 水平线
    if (tagName === 'HR') {
        return '\n---\n';
    }

    // DIV 和 其他块级元素
    if (tagName === 'DIV' || tagName === 'SECTION' || tagName === 'ARTICLE') {
        const content = extractChildrenContent(element, context);
        return content;
    }

    // 默认：递归处理子节点
    return extractChildrenContent(element, context);
};

/**
 * 提取元素所有子节点的内容
 * @param {Element} element
 * @param {Object} context
 * @returns {string}
 */
const extractChildrenContent = (element, context = {}) => {
    let result = '';

    for (const child of element.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
            const parent = child.parentElement;

            // 跳过渲染器内部文本
            if (parent?.closest('.katex, mjx-container, .MathJax, .cascade-mermaid-container')) {
                continue;
            }
            if (parent?.closest('[class*="language-"]')) {
                continue;
            }

            const parentClassStr = getClassString(parent);
            if (
                parentClassStr.includes('opacity-60') &&
                parent?.closest('pre')?.previousElementSibling
            ) {
                continue;
            }

            const textContent = (child.textContent || '').trim().toLowerCase();
            if (
                COMMON_LANGS.has(textContent) &&
                parent?.closest('pre')?.parentElement?.querySelector('[class*="language-"]')
            ) {
                continue;
            }

            if (
                parent?.closest(`.${BUTTON_CLASS}`) ||
                parent?.closest(`.${BOTTOM_BUTTON_CLASS}`) ||
                parent?.closest('.custom-copy-btn')
            ) {
                continue;
            }

            result += child.textContent || '';
        } else if (child.nodeType === Node.ELEMENT_NODE) {
            result += extractNodeContent(child, context);
        }
    }

    return result;
};

/**
 * 提取格式化内容（代码块、表格、数学公式、Mermaid、Markdown 格式等）
 * @param {Element} element - 待提取的根节点
 * @param {boolean} [useRawText=false] - 此参数已废弃，保留以兼容现有调用
 * @returns {string}
 * 实现思路：递归遍历 DOM，识别各种 HTML 元素并转换为对应的 Markdown 格式，
 * 包括标题、加粗、斜体、列表、链接、代码块、表格等。
 */
export const extractFormattedContent = (element, useRawText = false) => {
    if (!element) return '';

    const result = extractNodeContent(element, {});

    // 清理多余的空行，保持格式整洁
    return result
        .replace(/\n{3,}/g, '\n\n')  // 最多保留两个连续换行
        .trim();
};
