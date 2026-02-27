# Developer Guide

English | [中文](developer-guide.md)

This guide explains how to debug Antigravity and develop UI enhancements.

## Project Overview

Anti-Power is a patch tool that enhances Antigravity IDE, primarily improving the sidebar (legacy: cascade-panel / modern: sidebar-panel) and Manager window content copy functionality.

## Directory Structure

```
patcher/
├── src/                    # Tauri frontend (Vue.js)
├── src-tauri/              # Tauri backend (Rust)
├── patches/
│   ├── cascade-panel/      # Sidebar patch module
│   │   ├── cascade-panel.js    # Entry file
│   │   ├── cascade-panel.css   # Styles
│   │   ├── constants.js        # Constants
│   │   ├── extract.js          # Content extraction core logic
│   │   ├── copy.js             # Copy button functionality
│   │   ├── scan.js             # DOM scanning and button injection
│   │   ├── utils.js            # Utility functions
│   │   ├── math.js             # KaTeX math rendering
│   │   ├── mermaid.js          # Mermaid diagram rendering
│   │   └── icons.js            # Icon definitions
│   ├── sidebar-panel/      # Modern sidebar patch module (workbench.html entry)
│   │   ├── sidebar-panel.js    # Entry file
│   │   ├── sidebar-panel.css   # Styles
│   │   ├── constants.js        # Constants
│   │   ├── copy.js             # Copy button functionality
│   │   ├── scan.js             # DOM scanning and button injection
│   │   ├── utils.js            # Utility functions
│   │   ├── math.js             # KaTeX math rendering
│   │   └── mermaid.js          # Mermaid diagram rendering
│   └── manager-panel/      # Manager window patch module
│       ├── manager-panel.js    # Entry file
│       ├── manager-panel.css   # Styles
│       ├── constants.js        # Constants
│       ├── copy.js             # Content extraction and copy
│       ├── scan.js             # DOM scanning and button injection
│       ├── utils.js            # Utility functions
│       ├── math.js             # KaTeX math rendering
│       └── mermaid.js          # Mermaid diagram rendering
```

## Patch Installation Paths

- **sidebar (legacy)**: `<Antigravity>/resources/app/extensions/antigravity/cascade-panel/`
- **sidebar (modern)**: `<Antigravity>/resources/app/out/vs/code/electron-browser/workbench/sidebar-panel/`
- **manager-panel**: `<Antigravity>/resources/app/out/vs/code/electron-browser/workbench/manager-panel/`

## Quick Development Workflow

No need to rebuild patcher every time - just copy files directly for testing:

```bash
# From project root, enter patcher directory first
cd patcher

# Copy sidebar legacy (example path)
cp ./patches/cascade-panel/*.js ./patches/cascade-panel/*.css "E:/Antigravity/resources/app/extensions/antigravity/cascade-panel/"

# Copy sidebar modern (example path)
cp ./patches/sidebar-panel/*.js ./patches/sidebar-panel/*.css "E:/Antigravity/resources/app/out/vs/code/electron-browser/workbench/sidebar-panel/"

# Copy manager-panel (example path)
cp ./patches/manager-panel/*.js ./patches/manager-panel/*.css "E:/Antigravity/resources/app/out/vs/code/electron-browser/workbench/manager-panel/"
```

Then in Antigravity:
1. Press `Ctrl+Shift+I` to open developer tools
2. Press `Ctrl+R` to refresh the page

**Note**: Manager window is independent and needs to be refreshed separately.

---

## Getting DOM Structure

### Method 1: Built-in Developer Tools (Recommended for main window/sidebar)

1. Press `Ctrl+Shift+P` in Antigravity main window
2. Type "Developer: Toggle Developer Tools"
3. Open console to inspect any DOM structure (including sidebar)

### Method 2: Playwright Remote Debugging (For Manager window)

Manager window cannot use Method 1, requires remote debugging.

1. Close all Antigravity windows
2. Start in debug mode:
   ```powershell
   & "<Antigravity-install-dir>\Antigravity.exe" --remote-debugging-port=9222
   ```
3. Manually open Manager window
4. Copy the WebSocket URL from terminal output
5. Run Playwright script:
   ```powershell
   cd tests
   node scripts/dump-manager-dom.js "ws://127.0.0.1:9222/devtools/browser/your-UUID"
   ```

Available scripts (in `tests/scripts/`):

- `scripts/connect-antigravity.js`: Connect to 9222 and list available pages
- `scripts/dump-manager-dom.js`: Export complete HTML, DOM tree and key elements to `tests/temp`
- `scripts/debug-manager.js`: Quick check patch loading and key selectors
- `scripts/debug-manager-advanced.js`: Deep diagnostics including resource loading, render state, error detection

---

## Known Hook Points

| Hook Point | File Path | Scope |
|------------|-----------|-------|
| **Sidebar Panel (Legacy)** | `extensions/antigravity/cascade-panel.html` | Legacy sidebar dialog |
| **Sidebar Panel (Modern)** | `out/vs/code/electron-browser/workbench/workbench.html` | Modern sidebar entry |
| **Manager Window** | `out/vs/code/electron-browser/workbench/workbench-jetski-agent.html` | Agent Manager standalone window |

---

## Important Directories and Files

Paths relative to Antigravity installation directory (e.g., `C:\Program Files\Antigravity\`):

```
<install-dir>/
└── resources/
    └── app/
        ├── extensions/
        │   └── antigravity/
        │       └── cascade-panel.html      <- Legacy sidebar hook point
        │
        └── out/
            └── vs/
                └── code/
                    └── electron-browser/
                        └── workbench/
                            ├── workbench.html              <- Modern sidebar hook point
                            ├── workbench-jetski-agent.html <- Manager hook point
                            └── jetskiAgent.js              <- Manager main script
```

---

## Core Module Documentation

### extract.js/copy.js (Content Extraction)

Responsible for extracting content from DOM and converting to Markdown format.

**Supported Content Types**:
- Code blocks (with language identifier)
- Inline code (`pre.inline` structure)
- Ordered/unordered lists (with nesting support)
- Tables
- Math formulas (KaTeX/MathJax, restore LaTeX source)
- Mermaid diagrams (restore source code)
- Headings (convert to # format)

**Key Functions**:
- `extractFormattedContent()` / `extractFormattedText()` - Main extraction function
- `extractCodeBlockContent()` - Extract code blocks, auto-detect language
- `extractListItemContent()` - Extract list item content
- `extractOrderedList()` / `extractUnorderedList()` - Recursively process nested lists
- `extractLatexFromMath()` - Restore LaTeX from rendered formulas
- `extractTable()` - Table to Markdown

### constants.js

Shared constants:
- `BUTTON_CLASS` - Top-right copy button class name
- `BOTTOM_BUTTON_CLASS` - Bottom-right copy button class name
- `BOUND_ATTR` - Attribute marking bound copy functionality
- `RAW_TEXT_PROP` - Property name for cached raw text
- `MERMAID_SOURCE_PROP` - Property name for cached Mermaid source
- `COMMON_LANGS` - Common programming languages set (for filtering noise)

### scan.js

DOM change monitoring and button injection:
- Uses MutationObserver to monitor DOM changes
- Automatically adds copy buttons to content areas
- Handles Mermaid and math formula rendering

---

## DOM Structure Reference

### Inline Code
```html
<pre class="inline"><code class="...">code content</code></pre>
```
Should extract as: `` `code content` ``

### Code Block
```html
<pre>
  <div>
    <div class="font-sans">c</div>  <!-- Language label display -->
  </div>
  <div class="language-c ...">      <!-- language-xxx is here -->
    <div class="code-block">
      <div class="code-line">
        <div class="line-content">code line 1</div>
      </div>
      ...
    </div>
  </div>
</pre>
```
`extractCodeBlockContent()` searches in order:
1. Current element's class
2. Child elements with `[class*="language-"]`
3. Parent element's class

### List Structure
```html
<ol>
  <li>
    text content
    <pre class="inline"><code>inline code</code></pre>
    <pre>...</pre>  <!-- Code block -->
    <ul>          <!-- Nested list -->
      <li>...</li>
    </ul>
  </li>
</ol>
```

---

## Development Progress

### Completed Features

- [x] Basic copy functionality (top-right hover + bottom-right persistent buttons)
- [x] Code block extraction (with language identifier)
- [x] Inline code extraction (`pre.inline` -> backticks)
- [x] Nested list support (ordered/unordered, recursive processing)
- [x] Table to Markdown
- [x] Math formula restore LaTeX source
- [x] Mermaid diagram restore source
- [x] Heading to Markdown # format
- [x] Filter STYLE/SCRIPT/SVG tags
- [x] Filter copy button text
- [x] Inline code monospace font fix (sidebar legacy/modern)
- [x] Remove empty lines to optimize Markdown format
- [x] KaTeX parallel loading optimization

### Known Issues

- [ ] **Manager code blocks missing language identifier**
  - Reason: Manager DOM does not provide `language-xxx` class or other reliable language metadata (upstream limitation)
  - Note: See [known-issues.md](../reference/known-issues.md)

### TODO

- [ ] More edge case handling
- [ ] Unit tests

---

## Code Conventions

### Naming Convention
- cascade-panel uses `cascade-` prefix (e.g., `cascade-copy-button`)
- sidebar-panel uses `sidebar-` prefix (e.g., `sidebar-copy-btn`)
- manager-panel uses `manager-` prefix (e.g., `manager-copy-btn`)

### Extraction Logic Sync
Sidebar modules (`cascade-panel` / `sidebar-panel`) and manager-panel extraction logic should keep in sync. When modifying one, sync the others.

### Skipping Elements
Use `skipUntilEndOfBlock` variable with `contains()` check to skip processed subtrees:
```javascript
if (skipUntilEndOfBlock && skipUntilEndOfBlock.contains(currentNode)) {
    continue;
}
```

### Content to Skip
- `SKIP_TAGS`: STYLE, SCRIPT, NOSCRIPT, TEMPLATE, SVG
- Copy button elements and their inner text
- Already processed code blocks/formulas/list inner text
- File icon containers (`show-file-icons`, `file-icon`)

---

## Build and Release

```bash
cd patcher
npm run tauri:build
```

Build output: `src-tauri/target/release/anti-power.exe`

---

## Notes

- ~~Modifying `workbench-jetski-agent.html` triggers "Extension corrupted" prompt~~ (Fixed in v2.3.2+)
- Manager window uses React + TailwindCSS stack
- Sidebar uses variant-based entry (`cascade-panel.html` for legacy, `workbench.html` for modern)
