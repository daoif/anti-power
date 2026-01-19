/** Keep Manager copy controls independent of the legacy Cascade Panel */

import {
    CONTENT_SELECTOR,
    BOUND_ATTR,
    BUTTON_CLASS,
    COPY_BTN_CLASS,
    MERMAID_SOURCE_PROP,
    RAW_TEXT_PROP,
} from './constants.js';
import { createCopyButton, copyToClipboard, showCopySuccess } from './utils.js';

const SKIP_TAGS = new Set(['STYLE', 'SCRIPT', 'NOSCRIPT', 'TEMPLATE']);
const BLOCK_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI']);
const COMMON_LANGS = new Set([
    'xml',
    'html',
    'css',
    'javascript',
    'typescript',
    'python',
    'java',
    'json',
    'bash',
    'shell',
    'sql',
    'yaml',
    'markdown',
    'md',
    'go',
    'rust',
    'c',
    'cpp',
    'csharp',
    'php',
    'ruby',
    'swift',
    'kotlin',
]);

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
        markdown += `| ${cellContents.join(' | ')} |\n`;
        if (rowIdx === 0 && row.querySelector('th')) {
            markdown += `| ${cellContents.map(() => '---').join(' | ')} |\n`;
        }
    });
    return markdown;
};

/**
 * @param {Element} root
 * @returns {string}
 */
const extractCodeBlock = (root) => {
    const codeRoot = root.classList?.contains('code-block')
        ? root
        : root.querySelector?.('.code-block');

    if (codeRoot) {
        const lines = codeRoot.querySelectorAll('.line-content');
        if (lines.length > 0) {
            return Array.from(lines)
                .map((line) => line.textContent || '')
                .join('\n');
        }
        return codeRoot.textContent || '';
    }

    return root.textContent || '';
};

/**
 * @param {Element} el
 * @returns {boolean}
 */
const isVisibleElement = (el) => {
    if (!el || !el.isConnected) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
};

const normalizeLang = (lang) => {
    if (!lang) return '';
    const lowered = String(lang).trim().toLowerCase();
    if (lowered === 'markdown') return 'md';
    return lowered;
};

const looksLikeMarkdown = (text) => {
    if (!text) return false;
    const lines = text.split(/\r?\n/).map((line) => line.trim());
    const hasTable = lines.some((line) => line.includes('|')) &&
        lines.some((line) => /^(\|?\s*:?-{3,}:?\s*)\|/.test(line));
    const hasHeading = lines.some((line) => /^#{1,6}\s+/.test(line));
    const hasList = lines.some((line) => /^[-*+]\s+/.test(line) || /^\d+\.\s+/.test(line));
    return hasTable || hasHeading || hasList;
};

const resolveCodeLanguage = (element, codeText) => {
    const candidates = [
        element,
        element.closest?.('pre') || null,
        element.parentElement,
    ].filter(Boolean);

    for (const target of candidates) {
        const raw =
            target.getAttribute?.('data-language') ||
            target.getAttribute?.('data-lang') ||
            target.getAttribute?.('data-mode') ||
            target.getAttribute?.('data-code-language');
        const normalized = normalizeLang(raw);
        if (normalized) return normalized;
    }

    const pre = element.closest?.('pre') || element;
    const prev = pre?.previousElementSibling;
    if (prev && prev.textContent) {
        const label = normalizeLang(prev.textContent);
        if (label && COMMON_LANGS.has(label)) return label;
    }

    const text = codeText || '';
    if (looksLikeMarkdown(text)) return 'md';

    return '';
};

/**
 * Prefer the cached original text when available
 * @param {HTMLElement} el
 * @returns {string}
 */
const extractFormattedText = (el) => {
    if (!el) return '';

    const hasRichBlock = el.querySelector('pre, .code-block, table, .manager-mermaid-container');
    if (!hasRichBlock && el[RAW_TEXT_PROP] !== undefined) {
        return String(el[RAW_TEXT_PROP]).trim();
    }

    let result = '';
    const walker = document.createTreeWalker(
        el,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
        null,
        false
    );

    const ensureLineBreak = () => {
        if (result && !result.endsWith('\n')) {
            result += '\n';
        }
    };

    let currentNode;
    let skipUntilEndOfBlock = null;

    while ((currentNode = walker.nextNode())) {
        if (skipUntilEndOfBlock && skipUntilEndOfBlock.contains(currentNode)) {
            continue;
        }
        skipUntilEndOfBlock = null;

        if (currentNode.nodeType === Node.ELEMENT_NODE) {
            const element = currentNode;
            if (SKIP_TAGS.has(element.tagName)) {
                skipUntilEndOfBlock = element;
                continue;
            }

            const classString = getClassString(element);

            if (BLOCK_TAGS.has(element.tagName)) {
                ensureLineBreak();
            }

            if (classString.includes('manager-mermaid-container')) {
                const source = element[MERMAID_SOURCE_PROP];
                if (source) {
                    ensureLineBreak();
                    result += `\`\`\`mermaid\n${source}\n\`\`\`\n`;
                }
                skipUntilEndOfBlock = element;
                continue;
            }

            if (element.tagName === 'TABLE') {
                const table = extractTable(element).trimEnd();
                if (table) {
                    ensureLineBreak();
                    result += `${table}\n`;
                }
                skipUntilEndOfBlock = element;
                continue;
            }

            if (element.tagName === 'PRE' || classString.includes('code-block')) {
                const code = extractCodeBlock(element).trimEnd();
                if (code) {
                    const lang = resolveCodeLanguage(element, code);
                    const fence = lang ? `\`\`\`${lang}` : '```';
                    ensureLineBreak();
                    result += `${fence}\n${code}\n\`\`\`\n`;
                }
                skipUntilEndOfBlock = element;
                continue;
            }
        } else if (currentNode.nodeType === Node.TEXT_NODE) {
            const parent = currentNode.parentElement;
            if (!parent) continue;

            const text = currentNode.textContent || '';
            if (!text.trim()) {
                if (text.includes('\n')) {
                    continue;
                }
                if (result && !result.endsWith(' ') && !result.endsWith('\n')) {
                    result += ' ';
                }
                continue;
            }

            if (parent.closest('style, script, noscript, template')) {
                continue;
            }
            if (parent.closest('.manager-copy-btn, .manager-copy-button, .manager-feedback-copy')) {
                continue;
            }
            if (parent.closest('.code-block, pre')) {
                continue;
            }

            result += text;
        }
    }

    return result.trim();
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

    // Anchor the floating copy controls to the content container
    const style = window.getComputedStyle(contentEl);
    if (style.position === 'static') {
        contentEl.style.position = 'relative';
    }

    const btn = createCopyButton(`${COPY_BTN_CLASS} ${BUTTON_CLASS}`);
    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const text = extractFormattedText(contentEl);
        const success = await copyToClipboard(text);
        if (success) showCopySuccess(btn);
    });

    contentEl.appendChild(btn);
};

/** Insert copy buttons beside the Good/Bad feedback controls */
export const addFeedbackCopyButtons = () => {
    const feedbackContainers = document.querySelectorAll('[data-tooltip-id^="up-"]');

    feedbackContainers.forEach((goodBtn) => {
        const parent = goodBtn.parentElement;
        if (!parent || parent.querySelector('.manager-feedback-copy')) return;

        let contentEl = null;
        let node = parent;
        for (let i = 0; i < 20 && node; i++) {
            const candidates = node.querySelectorAll(CONTENT_SELECTOR);
            if (candidates.length > 0) {
                const visible = Array.from(candidates).filter((el) => isVisibleElement(el));
                contentEl = visible[visible.length - 1] || candidates[candidates.length - 1];
                break;
            }
            node = node.parentElement;
        }
        if (!contentEl) return;

        const btn = createCopyButton(`${COPY_BTN_CLASS} manager-feedback-copy`);
        btn.style.marginRight = '0.5rem';
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const text = extractFormattedText(contentEl);
            const success = await copyToClipboard(text);
            if (success) showCopySuccess(btn);
        });

        parent.insertBefore(btn, goodBtn);
    });
};
