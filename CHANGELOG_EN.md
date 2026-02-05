# Changelog

This document records changes for each Anti-Power version.

[中文](CHANGELOG.md) | English

---

## v3.0.1 (2026-02-05)

### New Features
- Cleaning tool now supports Gemini CLI, Codex and Claude Code, with only Antigravity selected by default.
- Cleaning tool now adds an enable switch to prevent accidental triggering.
- Added English scripts `anti-power.en.sh`/`anti-clean.en.sh`

### Fixes
- Fixed Chinese output when running scripts in English mode

### Documentation
- Manual install guide updated to include English scripts
- Synced README/Changelog/Release Notes to v3.0.1

---

## v3.0.0 (2026-02-04)

### New Features
- UI language switch (Chinese/English)
- Light/dark theme toggle
- Collapsible feature cards for sidebar/Manager options

### Improvements
- Installer layout redesigned with a responsive two-column view; clean tool placement adapts to screen size
- Visual refresh across typography, color tokens, buttons, cards, modals, and animations

### Fixes
- Fixed the execution logic of cleaning tools (macOS/Linux) to ensure secondary confirmation

### Documentation
- Synced README/Changelog/Release Notes to v3.0.0
- README: update supported Antigravity version to v1.16.5 and standardize macOS app name to `Anti-Power.app`

---

## v2.4.0 (2026-02-02)

### New Features
- macOS Universal Build support
- Added `icon-gen` icon generation script
- Added `npm run clean` command
- Dependency updates

### Documentation
- Synced cross-platform installation instructions
- Fixed legacy documentation issues

---

## v2.3.4 (2026-02-01)

> Community contribution: Thanks to [@mikessslxxx](https://github.com/mikessslxxx) for PR #18

### New Features
- macOS/Linux cross-platform support
- Cross-platform path normalization and detection
- Unix privileged installation flow (sudo/pkexec)
- GitHub Actions automated build and release

### Improvements
- Enhanced path detection with Linux support
- Frontend adapts to macOS Resources path
- Window decoration strategy adjusted for macOS system title bar

---

## v2.3.3 (2026-01-31)

### Fixes
- Fix critical bug where math formula rendering fails
- Temporarily rollback formula rendering logic to v2.0.1 stable version
- Add formula rendering mode switch (Classic/Deferred)

---

## v2.3.2 (2026-01-31)

> Community contribution: Thanks to [@mikessslxxx](https://github.com/mikessslxxx)

### Improvements
- Math formula rendering optimization
- Copy button style optimization

### New Features
- Copy button offers more customization options (style, position, etc.)

### Fixes
- Fix "Installation appears corrupted" prompt caused by Manager patch

---

## v2.3.1 (2026-01-31)

> Community contribution: Thanks to [@Sophomoresty](https://github.com/Sophomoresty) for the PR

### New Features
- Persistent copy button at bottom-right corner for easy content copying
- Developer documentation (bilingual: English and Chinese)

### Improvements
- KaTeX CSS and JS parallel loading for faster initial formula rendering
- Top-right hover button moved up to avoid text obstruction
- Code blocks use monospace font stack (Cascadia Code, Fira Code, etc.)
- Remove excess empty lines in copied content

### Fixes
- Correctly identify code blocks and language identifiers in nested lists
- Inline code (`pre.inline`) correctly extracted as backtick format
- Filter SVG tags to avoid copying icon code

### Changes
- Removed copy button from good/bad feedback area (reduce UI clutter)
- Manager features (mermaid, math) enabled by default

---

## v2.3.0 (2026-01-30)

### New Features
- Copy function supports Markdown format preservation (headings/lists/bold/italic/links etc.)

---

## v2.2.0 (2026-01-21)

> Community contribution: Thanks to [@mikessslxxx](https://github.com/mikessslxxx)

### New Features
- Manager window Mermaid rendering
- Manager window math formula rendering
- Manager window conversation width adjustment
- Manager window font size adjustment

---

## v2.1.0 (2026-01-19)

### New Features
- Sidebar font size adjustment
- Manager window one-click copy

### Improvements
- Mermaid rendering error hint optimization

---

## v2.0.1 (2026-01-14)

### Improvements
- Performance optimization

---

## v2.0.0 (2026-01-14)

### New Features
- New Tauri installation tool
- Support for toggling individual features

---

## v1.2.1 (2026-01-13)

### Fixes
- Bug fixes

---

## v1.2.0 (2026-01-13)

### New Features
- Mermaid flowchart rendering

---

## v1.1.0 (2026-01-13)

> Community contribution: Thanks to [@mikessslxxx](https://github.com/mikessslxxx)

### New Features
- Math formula rendering (KaTeX)

---

## v1.0.0 (2026-01-13)

### Initial Release
- One-click copy button
- Table color fix (dark theme)
