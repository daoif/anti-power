/** Serialize DOM content as Markdown, restoring the original LaTeX and Mermaid source */

import {
    BUTTON_CLASS,
    COMMON_LANGS,
    MERMAID_SOURCE_PROP,
    RAW_TEXT_PROP,
} from './constants.js';
import { getClassString } from './utils.js';

/**
 * Read cell text without expanding merged cells or nested markup
 *
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
 * Recover LaTeX from KaTeX or MathJax output
 * @param {Element} mathEl
 * @returns {string|null} Null if the original LaTeX cannot be recovered
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
 * @param {Element} el
 * @returns {string}
 */
const getInnerText = (el) => {
    if (!el) return '';
    return el.textContent || '';
};

/**
 * @param {Element} element
 * @param {Object} context
 * @returns {string}
 */
const extractNodeContent = (element, context = {}) => {
    if (!element) return '';

    const classString = getClassString(element);
    const tagName = element.tagName;

    if (['STYLE', 'SCRIPT', 'NOSCRIPT', 'TEMPLATE'].includes(tagName)) {
        return '';
    }

    if (
        classString.includes(BUTTON_CLASS) ||
        classString.includes('custom-copy-btn') ||
        classString.includes('cascade-copy-btn')
    ) {
        return '';
    }

    // Prefer recovered LaTeX to the renderer's display text
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

    // Copy Mermaid source instead of the rendered diagram
    if (classString.includes('cascade-mermaid-container')) {
        const source = element[MERMAID_SOURCE_PROP];
        if (source) {
            return `\n\`\`\`mermaid\n${source}\n\`\`\`\n`;
        }
        return '';
    }

    if (tagName === 'TABLE') {
        return `\n${extractTable(element)}\n`;
    }

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

    if (/^H[1-6]$/.test(tagName)) {
        const level = parseInt(tagName[1], 10);
        const prefix = '#'.repeat(level);
        const content = extractChildrenContent(element, context);
        return `\n${prefix} ${content.trim()}\n`;
    }

    if (tagName === 'STRONG' || tagName === 'B') {
        const content = extractChildrenContent(element, context);
        const trimmed = content.trim();
        if (!trimmed) return '';
        return `**${trimmed}**`;
    }

    if (tagName === 'EM' || tagName === 'I') {
        const content = extractChildrenContent(element, context);
        const trimmed = content.trim();
        if (!trimmed) return '';
        return `*${trimmed}*`;
    }

    if (tagName === 'DEL' || tagName === 'S' || tagName === 'STRIKE') {
        const content = extractChildrenContent(element, context);
        const trimmed = content.trim();
        if (!trimmed) return '';
        return `~~${trimmed}~~`;
    }

    if (tagName === 'CODE' && !element.closest('pre')) {
        const text = element.textContent || '';
        if (!text.trim()) return '';
        return `\`${text}\``;
    }

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

    if (tagName === 'LI') {
        const parent = element.parentElement;

        let depth = 0;
        let ancestor = element.parentElement;
        while (ancestor) {
            if (ancestor.tagName === 'UL' || ancestor.tagName === 'OL') {
                depth++;
            }
            ancestor = ancestor.parentElement;
        }
        // Count the current list as depth 1 so top-level items stay unindented
        const indent = '  '.repeat(Math.max(0, depth - 1));

        // Separate item text from nested lists so each list keeps its own indentation
        let textContent = '';
        let nestedListContent = '';

        for (const child of element.childNodes) {
            if (child.nodeType === Node.ELEMENT_NODE) {
                const childTag = child.tagName;
                if (childTag === 'UL' || childTag === 'OL') {
                    nestedListContent += extractNodeContent(child, context);
                } else {
                    textContent += extractNodeContent(child, context);
                }
            } else if (child.nodeType === Node.TEXT_NODE) {
                const text = child.textContent || '';
                // Exclude renderer internals from copied Markdown
                const parentEl = child.parentElement;
                if (parentEl?.closest('.katex, mjx-container, .MathJax, .cascade-mermaid-container')) {
                    continue;
                }
                if (parentEl?.closest('[class*="language-"]')) {
                    continue;
                }
                if (parentEl?.closest(`.${BUTTON_CLASS}`) || parentEl?.closest('.custom-copy-btn')) {
                    continue;
                }
                textContent += text;
            }
        }

        const trimmedText = textContent.trim();
        if (!trimmedText && !nestedListContent) return '';

        let prefix;
        if (parent?.tagName === 'OL') {
            const items = Array.from(parent.children).filter(c => c.tagName === 'LI');
            const index = items.indexOf(element) + 1;
            prefix = `${indent}${index}. `;
        } else {
            prefix = `${indent}- `;
        }

        if (nestedListContent) {
            return `${prefix}${trimmedText}\n${nestedListContent}`;
        } else {
            return `${prefix}${trimmedText}\n`;
        }
    }

    // Avoid adding a blank line before nested lists
    if (tagName === 'UL' || tagName === 'OL') {
        const isTopLevel = !element.parentElement?.closest('li');
        const content = extractChildrenContent(element, context);
        return isTopLevel ? `\n${content}` : content;
    }

    if (tagName === 'P') {
        const content = extractChildrenContent(element, context);
        const trimmed = content.trim();
        if (!trimmed) return '';
        return `\n${trimmed}\n`;
    }

    if (tagName === 'BR') {
        return '\n';
    }

    if (tagName === 'BLOCKQUOTE') {
        const content = extractChildrenContent(element, context);
        const lines = content.trim().split('\n');
        const quoted = lines.map(line => `> ${line}`).join('\n');
        return `\n${quoted}\n`;
    }

    if (tagName === 'HR') {
        return '\n---\n';
    }

    if (tagName === 'DIV' || tagName === 'SECTION' || tagName === 'ARTICLE') {
        const content = extractChildrenContent(element, context);
        return content;
    }

    return extractChildrenContent(element, context);
};

/**
 * @param {Element} element
 * @param {Object} context
 * @returns {string}
 */
const extractChildrenContent = (element, context = {}) => {
    let result = '';

    for (const child of element.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
            const parent = child.parentElement;

            // Exclude renderer internals from copied Markdown
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
 * Walk the DOM recursively to preserve Markdown formatting
 *
 * @param {Element} element - Root of the content to copy
 * @param {boolean} [useRawText=false] - Retained for compatibility with existing calls
 * @returns {string}
 */
export const extractFormattedContent = (element, useRawText = false) => {
    if (!element) return '';

    const result = extractNodeContent(element, {});

    return result
        .replace(/\n{3,}/g, '\n\n')  // Keep at most one blank line between blocks
        .trim();
};
