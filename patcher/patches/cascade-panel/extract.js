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
 * Walk the DOM once and skip descendants of blocks already emitted as Markdown
 *
 * @param {Element} element - Root of the content to copy
 * @param {boolean} [useRawText=true] - Prefer cached original text when true
 * @returns {string}
 */
export const extractFormattedContent = (element, useRawText = true) => {
    const hasCodeBlock = element.querySelector(
        '[class*="language-"], .code-block, [aria-label^="highlighted-code"]'
    );
    const hasTable = element.querySelector('table');
    const hasMermaid = element.querySelector('.cascade-mermaid-container');

    if (!hasCodeBlock && !hasTable && !hasMermaid) {
        if (useRawText && element && element[RAW_TEXT_PROP] !== undefined) {
            return String(element[RAW_TEXT_PROP]).trim();
        }
    }

    let result = '';
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
        null,
        false
    );

    let currentNode;
    let skipUntilEndOfBlock = null;

    while ((currentNode = walker.nextNode())) {
        // Skip descendants of blocks already serialized as Markdown
        if (skipUntilEndOfBlock && skipUntilEndOfBlock.contains(currentNode)) {
            continue;
        }
        skipUntilEndOfBlock = null;

        if (currentNode.nodeType === Node.ELEMENT_NODE) {
            const classString = getClassString(currentNode);

            // Prefer recovered LaTeX to the renderer's display text
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

            // Restore the Mermaid source instead of copying the SVG
            if (classString.includes('cascade-mermaid-container')) {
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

            // Keep the language label and line breaks in fenced code
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
                }
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
                // Exclude renderer internals to avoid duplicate or stray text
                if (parent.closest('.katex, mjx-container, .MathJax, .cascade-mermaid-container')) {
                    continue;
                }
                if (parent.closest('[class*="language-"]')) {
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

                if (
                    parent.closest(`.${BUTTON_CLASS}`) ||
                    parent.closest('.custom-copy-btn')
                ) {
                    continue;
                }
            }
            result += currentNode.textContent;
        }
    }

    return result.trim();
};
