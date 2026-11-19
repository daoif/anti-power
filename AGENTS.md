# AGENTS.md

English | [中文](AGENTS_ZH.md)

## What this project is

Anti-Power is a desktop tool (Tauri + Vue) that lists and cleans local sessions for the Antigravity App and the Antigravity CLI (`agy`). It does not manage other tools. The earlier IDE patches (Markdown copy, LaTeX, Mermaid) were removed after v4.0.0.

Usage and quota tracking is left to the [antigravity-usage-monitor](https://github.com/yuhuan-dev/antigravity-usage-monitor) plugin.

## Layout

- `patcher/src-tauri/src/commands/`: Rust backend
  - `antigravity_store.rs`: store roots, ID validation, symlink-safe path resolution
  - `antigravity_scan.rs`: session listing and message loading
  - `antigravity_clean.rs`: session cleanup
  - `sessions.rs`: the three Tauri commands (`scan_sessions`, `load_session_messages`, `delete_sessions`)
- `patcher/src/`: Vue frontend; `components/SessionViewer.vue` is the main view
- `patcher/src/locales/`: `zh-CN` and `en-US` strings
- `.github/workflows/release.yml`: installer builds for Windows, macOS, and Linux

## Session stores

| Source | Root | Summary index |
|--------|------|---------------|
| Antigravity App (`antigravity`) | `~/.gemini/antigravity` | `agyhub_summaries_proto.pb` |
| Antigravity CLI (`agy`) | `~/.gemini/antigravity-cli`, `~/.cc-switch/agy/<profile>/antigravity-cli` | `jetbox_summaries_proto.pb` |

A session is identified by its source and UUID. Under each root, a session can appear in `conversations/`, `brain/`, `annotations/`, `presence/`, `conversation_summaries.db` (summaries, FTS, parents), the summary index, `cache/last_conversations.json`, `cache/conversation_metadata.json`, and `history.jsonl` (the Antigravity CLI prompt history). The README lists what cleanup removes and what it leaves.

Last checked on macOS against Antigravity App 2.33.0 and Antigravity CLI 1.5.12. Antigravity IDE (`~/.gemini/antigravity-ide`) is out of scope.

## Cleanup rules

- Refuse to run while the Antigravity App, the Antigravity CLI, or Antigravity IDE is running, and name the one to quit.
- Never follow symlinks inside a store.
- Stage files in `.anti-power-clean-*` and record the commit in the index transaction. After an interruption, restore uncommitted files and finish committed deletions. A scan reports a failed recovery as a warning and still lists sessions.
- Clean each store in one pass for a batch: one transaction, one FTS rebuild, one `VACUUM`. When a batch fails, retry sessions one by one unless the failure is store-wide.
- Fail without changes when a summary index has an unknown layout.
- Nested agent runs (`nesting_depth > 0`) go with their parent. Forks stay.
- A session listed by another tool must be listed here, including records with only index entries.

## Build and test

Run in `patcher/`:

```bash
npm install
npm run build          # type check and frontend build
npm run tauri:dev      # run the app
cd src-tauri && cargo test && cargo clippy --all-targets
```

Tests build synthetic stores in temporary directories. Never run cleanup against a real store in tests.

## Conventions

- Keep code and docs short.
- Code comments are in English, with one space after the comment marker and no trailing period.
- Docs use English punctuation in both languages.
- Leave published release notes and changelog entries as they are.
- `patcher/package.json`, `patcher/src-tauri/tauri.conf.json`, and `patcher/src-tauri/Cargo.toml` share one version number (see `docs/guides/release-guide.md`).
