/**
 * Keep Manager copy controls independent of the legacy Cascade Panel
 * Match the Markdown extraction in cascade-panel/extract.js
 */

import {
    BOUND_ATTR,
    BUTTON_CLASS,
    BOTTOM_BUTTON_CLASS,
    COPY_BTN_CLASS,
    MERMAID_SOURCE_PROP,
    RAW_TEXT_PROP,
} from './constants.js';
import { createCopyButton, copyToClipboard, showCopySuccess } from './utils.js';

// Filter language labels out of copied code
const COMMON_LANGS = new Set([
    'xml', 'html', 'css', 'javascript', 'typescript', 'python', 'java',
    'json', 'bash', 'shell', 'sql', 'yaml', 'markdown', 'md', 'go', 'rust',
    'c', 'cpp', 'csharp', 'php', 'ruby', 'swift', 'kotlin',
]);

// Exclude these elements and their descendants from Markdown extraction
const SKIP_TAGS = new Set(['STYLE', 'SCRIPT', 'NOSCRIPT', 'TEMPLATE', 'SVG']);

/**
 * Handle SVGAnimatedString as well as string class names
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
 * Extract the item's own text, inline code, and math
 * The caller handles nested lists and code blocks separately
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

            // Leave nested lists for the caller to process recursively
            if (tag === 'OL' || tag === 'UL') {
                skipUntil = node;
                continue;
            }

            // Treat pre.inline as inline code and leave other pre blocks to the caller
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

            if (classString.includes(BUTTON_CLASS) || classString.includes(BOTTOM_BUTTON_CLASS) || classString.includes('manager-copy-btn')) {
                skipUntil = node;
                continue;
            }

            // Handle inline code outside fenced code blocks
            if (tag === 'CODE' && !node.closest('pre')) {
                content += `\`${node.textContent}\``;
                skipUntil = node;
                continue;
            }

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
            // Skip text already collected from inline code or rendered math
            if (parent && parent.closest('code, .katex, mjx-container')) continue;
            // Leave code block text for the caller
            if (parent && parent.closest('pre, .code-block, [class*="language-"]')) continue;
            if (parent && parent.closest(`.${BUTTON_CLASS}, .${BOTTOM_BUTTON_CLASS}, .manager-copy-btn`)) continue;
            content += node.textContent;
        }
    }

    return content.trim().replace(/\n+/g, ' ');
};

/**
 * @param {Element} codeBlockContainer - Container that owns the source block
 * @returns {string} Fenced Markdown code block
 */
const extractCodeBlockContent = (codeBlockContainer) => {
    // Resolve the language from the container, then a descendant, then the parent
    let classString = getClassString(codeBlockContainer);
    let langMatch = classString.match(/language-(\w+)/);

    if (!langMatch) {
        const langEl = codeBlockContainer.querySelector('[class*="language-"]');
        if (langEl) {
            const langElClass = getClassString(langEl);
            langMatch = langElClass.match(/language-(\w+)/);
        }
    }

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
 * Preserve nested ordered lists
 * @param {HTMLOListElement} olEl
 * @param {number} depth - List nesting depth
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

        // Collect only code blocks belonging to this list item
        const codeBlocks = li.querySelectorAll('pre:not(.inline), div[class*="language-"]');
        codeBlocks.forEach((block) => {
            // Leave nested list code blocks for the recursive pass
            const closestLi = block.closest('li');
            if (closestLi !== li) return;
            const codeMarkdown = extractCodeBlockContent(block);
            // Indent the fence and code lines so Markdown keeps them inside the list item
            const indentedCode = codeMarkdown.split('\n').map(line => indent + '   ' + line).join('\n');
            markdown += indentedCode + '\n';
        });

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
 * Preserve nested unordered lists
 * @param {HTMLUListElement} ulEl
 * @param {number} depth - List nesting depth
 * @returns {string}
 */
const extractUnorderedList = (ulEl, depth = 0) => {
    let markdown = '\n';
    const items = ulEl.querySelectorAll(':scope > li');
    const indent = '   '.repeat(depth); // 3 spaces per depth level

    items.forEach((li) => {
        const content = extractListItemContent(li);
        markdown += `${indent}- ${content}\n`;

        // Collect only code blocks belonging to this list item
        const codeBlocks = li.querySelectorAll('pre:not(.inline), div[class*="language-"]');
        codeBlocks.forEach((block) => {
            // Leave nested list code blocks for the recursive pass
            const closestLi = block.closest('li');
            if (closestLi !== li) return;
            const codeMarkdown = extractCodeBlockContent(block);
            // Indent the fence and code lines so Markdown keeps them inside the list item
            const indentedCode = codeMarkdown.split('\n').map(line => indent + '   ' + line).join('\n');
            markdown += indentedCode + '\n';
        });

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
 * Convert the table to Markdown
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
 * Serialize code, tables, math, Mermaid and lists as Markdown
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

    // Use cached raw text only if the DOM has no structure that needs Markdown conversion
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
        // Skip descendants of blocks already serialized as Markdown
        if (skipUntilEndOfBlock && skipUntilEndOfBlock.contains(currentNode)) {
            continue;
        }
        skipUntilEndOfBlock = null;

        if (currentNode.nodeType === Node.ELEMENT_NODE) {
            const classString = getClassString(currentNode);

            if (SKIP_TAGS.has(currentNode.tagName)) {
                skipUntilEndOfBlock = currentNode;
                continue;
            }

            const headingMatch = currentNode.tagName.match(/^H([1-6])$/);
            if (headingMatch) {
                const level = parseInt(headingMatch[1], 10);
                const prefix = '#'.repeat(level);
                const headingText = currentNode.textContent.trim();
                result += `\n${prefix} ${headingText}\n`;
                skipUntilEndOfBlock = currentNode;
                continue;
            }

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

            // Copy Mermaid source instead of the rendered diagram
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

            if (currentNode.tagName === 'OL') {
                result += extractOrderedList(currentNode);
                skipUntilEndOfBlock = currentNode;
                continue;
            }

            if (currentNode.tagName === 'UL') {
                result += extractUnorderedList(currentNode);
                skipUntilEndOfBlock = currentNode;
                continue;
            }

            // Prefer language-* classes when detecting code blocks
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

            // Let the walker reach a language-tagged descendant so it can preserve the language
            if (currentNode.tagName === 'PRE') {
                const hasLangChild = currentNode.querySelector('[class*="language-"]');
                if (hasLangChild) {
                    continue;
                }
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

            // Use .code-block as a fallback when no language class is present
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
                // Exclude renderer internals from copied Markdown
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

                if (parent.closest(`.${BUTTON_CLASS}, .${BOTTOM_BUTTON_CLASS}, .manager-copy-btn, .manager-feedback-copy`)) {
                    continue;
                }
            }
            result += currentNode.textContent;
        }
    }

    // Remove blank lines from the copied Markdown
    return result
        .split('\n')
        .filter(line => line.trim() !== '')
        .join('\n')
        .trim();
};

const HIGHLIGHT_CLASS = 'manager-copy-highlight';

/**
 * Highlight the content that the button will copy on hover
 * @param {HTMLElement} button
 * @param {HTMLElement} contentEl - Message content to highlight
 */
const bindHighlightEvents = (button, contentEl) => {
    button.addEventListener('mouseenter', () => {
        contentEl.classList.add(HIGHLIGHT_CLASS);
    });
    button.addEventListener('mouseleave', () => {
        contentEl.classList.remove(HIGHLIGHT_CLASS);
    });
};

/** @param {HTMLElement} contentEl */
export const ensureContentCopyButton = (contentEl) => {
    if (!contentEl || contentEl.getAttribute(BOUND_ATTR) === '1') return;

    if (contentEl[RAW_TEXT_PROP] === undefined) {
        const raw = contentEl.innerText !== undefined
            ? contentEl.innerText
            : contentEl.textContent || '';
        contentEl[RAW_TEXT_PROP] = raw;
    }

    contentEl.setAttribute(BOUND_ATTR, '1');

    // Keep absolute positioning relative to the content container
    const style = window.getComputedStyle(contentEl);
    if (style.position === 'static') {
        contentEl.style.position = 'relative';
    }

    // Top-right hover button
    const btn = createCopyButton(`${COPY_BTN_CLASS} ${BUTTON_CLASS}`, 'top');
    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const text = extractFormattedText(contentEl);
        const success = await copyToClipboard(text);
        if (success) showCopySuccess(btn);
    });
    bindHighlightEvents(btn, contentEl);
    contentEl.appendChild(btn);

    // The bottom-right hover button shares the content container as its positioning anchor
    const bottomBtn = createCopyButton(`${COPY_BTN_CLASS} ${BOTTOM_BUTTON_CLASS}`, 'bottom');
    bottomBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const text = extractFormattedText(contentEl);
        const success = await copyToClipboard(text);
        if (success) showCopySuccess(bottomBtn);
    });
    bindHighlightEvents(bottomBtn, contentEl);
    contentEl.appendChild(bottomBtn);
};
