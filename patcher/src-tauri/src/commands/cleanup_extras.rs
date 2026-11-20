//! Cleanup outside the session stores: Antigravity App window state and caches, and CC Switch sync records

use super::antigravity_clean::has_column;
use super::antigravity_store::{checked_path, APP_DATA};
use super::sessions::CleanOptions;
use rusqlite::{Connection, OpenFlags};
use serde_json::{Map, Value};
use std::collections::BTreeSet;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::Duration;

type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;

const APP_STORAGE: &str = "app_storage.json";
const APP_CACHES: [&str; 2] = ["Cache", "Code Cache"];
const LAYOUT_PREFIX: &str = "antigravity-multi-conversation-layout-v3-";
const LAYOUT_INDEX: &str = "antigravity-multi-conversation-layout-v3-index";
const PANES: [&str; 2] = ["aux-pane-session", "aux-pane-v2-session"];
const CC_SWITCH_DB: &str = ".cc-switch/cc-switch.db";
const CC_SWITCH_BACKUPS: &str = ".cc-switch/backups";

/// Sessions removed from one store, including nested agent runs
pub(super) struct Cleaned {
    pub root: PathBuf,
    pub ids: BTreeSet<String>,
}

/// Clean external data for removed sessions and return any warnings
pub(super) fn run(home: &Path, cleaned: &[Cleaned], options: CleanOptions) -> Vec<String> {
    let mut warnings = Vec::new();
    let ids: BTreeSet<String> = cleaned
        .iter()
        .flat_map(|store| store.ids.iter().cloned())
        .collect();
    // The App also shows Antigravity CLI conversations, so its window state covers both stores
    if let Err(error) = clean_app_storage(home, &ids) {
        warnings.push(format!("Antigravity App window state: {error}"));
    }
    if options.app_cache {
        for name in APP_CACHES {
            if let Err(error) = remove_app_cache(home, name) {
                warnings.push(format!("Antigravity App {name}: {error}"));
            }
        }
    }
    if options.cc_switch {
        match cc_switch_databases(home) {
            Ok(paths) => {
                for path in paths {
                    if let Err(error) = clean_cc_switch(&path, cleaned) {
                        warnings.push(format!("CC Switch {}: {error}", path.display()));
                    }
                }
            }
            Err(error) => warnings.push(format!("CC Switch: {error}")),
        }
    }
    warnings
}

fn clean_app_storage(home: &Path, ids: &BTreeSet<String>) -> Result<()> {
    let Some(path) = checked_path(home, &Path::new(APP_DATA).join(APP_STORAGE))? else {
        return Ok(());
    };
    let bytes = fs::read(&path)?;
    if let Some(filtered) = filtered_app_storage(&bytes, ids)? {
        replace_file(&path, &filtered)?;
    }
    Ok(())
}

fn filtered_app_storage(bytes: &[u8], ids: &BTreeSet<String>) -> Result<Option<Vec<u8>>> {
    let mut state: Map<String, Value> = serde_json::from_slice(bytes)?;
    let mut changed = false;
    state.retain(|key, _| {
        let keep = !key
            .strip_prefix(LAYOUT_PREFIX)
            .is_some_and(|id| ids.contains(id));
        changed |= !keep;
        keep
    });
    // These values are JSON documents stored as strings
    for key in PANES.into_iter().chain([LAYOUT_INDEX]) {
        let Some(Value::String(text)) = state.get_mut(key) else {
            continue;
        };
        let Ok(mut value) = serde_json::from_str::<Value>(text) else {
            continue;
        };
        let count = |value: &Value| match value {
            Value::Object(pane) => pane
                .get("conversationPanes")
                .and_then(Value::as_object)
                .map_or(0, Map::len),
            Value::Array(list) => list.len(),
            _ => 0,
        };
        let before = count(&value);
        match &mut value {
            Value::Object(pane) => {
                if let Some(panes) = pane
                    .get_mut("conversationPanes")
                    .and_then(Value::as_object_mut)
                {
                    panes.retain(|id, _| !ids.contains(id));
                }
            }
            Value::Array(list) => {
                list.retain(|item| !item.as_str().is_some_and(|id| ids.contains(id)));
            }
            _ => {}
        }
        if count(&value) != before {
            *text = serde_json::to_string(&value)?;
            changed = true;
        }
    }
    if !changed {
        return Ok(None);
    }
    let mut result = serde_json::to_vec_pretty(&state)?;
    if bytes.ends_with(b"\n") {
        result.push(b'\n');
    }
    Ok(Some(result))
}

fn replace_file(path: &Path, bytes: &[u8]) -> Result<()> {
    let dir = path.parent().ok_or("Invalid file path")?;
    let mut tmp = tempfile::NamedTempFile::new_in(dir)?;
    tmp.as_file()
        .set_permissions(fs::metadata(path)?.permissions())?;
    tmp.write_all(bytes)?;
    tmp.as_file().sync_all()?;
    tmp.persist(path)?;
    Ok(())
}

// Chromium rebuilds these caches, which cannot be filtered by conversation
fn remove_app_cache(home: &Path, name: &str) -> Result<()> {
    let Some(path) = checked_path(home, &Path::new(APP_DATA).join(name))? else {
        return Ok(());
    };
    if !path.is_dir() {
        return Err(format!("Expected a folder at {}", path.display()).into());
    }
    fs::remove_dir_all(path)?;
    Ok(())
}

fn cc_switch_databases(home: &Path) -> Result<Vec<PathBuf>> {
    let mut paths = Vec::new();
    if let Some(path) = checked_path(home, Path::new(CC_SWITCH_DB))? {
        if path.is_file() {
            paths.push(path);
        }
    }
    if let Some(dir) = checked_path(home, Path::new(CC_SWITCH_BACKUPS))? {
        if dir.is_dir() {
            let mut backups = Vec::new();
            for entry in fs::read_dir(dir)? {
                let entry = entry?;
                let database = entry
                    .file_name()
                    .to_str()
                    .is_some_and(|name| name.ends_with(".db"));
                if database && entry.file_type()?.is_file() {
                    backups.push(entry.path());
                }
            }
            backups.sort();
            paths.extend(backups);
        }
    }
    Ok(paths)
}

// Only remove sync progress; usage and cost history stays
fn clean_cc_switch(path: &Path, cleaned: &[Cleaned]) -> Result<()> {
    // The path has no symlinks below home, and SQLite refuses any above it
    let mut conn = Connection::open_with_flags(
        path.canonicalize()?,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NOFOLLOW,
    )?;
    conn.busy_timeout(Duration::from_secs(2))?;
    conn.pragma_update(None, "secure_delete", true)?;
    if !has_column(&conn, "session_log_sync", "file_path")? {
        return Ok(());
    }
    let tx = conn.transaction()?;
    let mut removed = 0;
    {
        // CC Switch tracks each transcript as "agy:<store>/brain/<id>/..."
        let mut statement = tx.prepare(
            "DELETE FROM session_log_sync
             WHERE substr(replace(file_path, '\\', '/'), 1, length(?1)) = ?1",
        )?;
        for store in cleaned {
            let root = store.root.to_string_lossy().replace('\\', "/");
            for id in &store.ids {
                removed += statement.execute([format!("agy:{root}/brain/{id}/")])?;
            }
        }
    }
    tx.commit()?;
    if removed > 0 {
        // Removed rows are already overwritten, so compacting is best effort
        let _ = conn.execute_batch("VACUUM");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const TARGET: &str = "00000000-0000-4000-8000-000000000001";
    const FORK: &str = "00000000-0000-4000-8000-000000000002";

    fn ids(list: &[&str]) -> BTreeSet<String> {
        list.iter().map(|id| (*id).to_owned()).collect()
    }

    fn app_storage() -> String {
        let panes = |version: bool| {
            let mut panes = serde_json::json!({"conversationPanes": {
                TARGET: {"tabs": []},
                FORK: {"tabs": []},
            }});
            if version {
                panes["version"] = 1.into();
            }
            panes.to_string()
        };
        let layout = |id: &str| format!(r#"{{"rootNode":{{"cascadeId":"{id}"}}}}"#);
        let state = serde_json::json!({
            "sidebarWidth": "320",
            "aux-pane-session": panes(false),
            "aux-pane-v2-session": panes(true),
            LAYOUT_INDEX: serde_json::json!([TARGET, FORK]).to_string(),
            format!("{LAYOUT_PREFIX}{TARGET}"): layout(TARGET),
            format!("{LAYOUT_PREFIX}{FORK}"): layout(FORK),
        });
        serde_json::to_string_pretty(&state).unwrap() + "\n"
    }

    #[test]
    fn removes_window_state_for_removed_sessions_only() {
        let original = app_storage();
        let filtered = filtered_app_storage(original.as_bytes(), &ids(&[TARGET]))
            .unwrap()
            .unwrap();
        let text = String::from_utf8(filtered).unwrap();
        assert!(!text.contains(TARGET) && text.contains(FORK) && text.ends_with("}\n"));
        let state: Map<String, Value> = serde_json::from_str(&text).unwrap();
        assert_eq!(state["sidebarWidth"], "320");
        assert!(state.contains_key(&format!("{LAYOUT_PREFIX}{FORK}")));
        let v2: Value =
            serde_json::from_str(state["aux-pane-v2-session"].as_str().unwrap()).unwrap();
        assert_eq!(v2["version"], 1);
        assert!(v2["conversationPanes"].get(FORK).is_some());

        let other = ids(&["00000000-0000-4000-8000-000000000009"]);
        assert!(filtered_app_storage(original.as_bytes(), &other)
            .unwrap()
            .is_none());
        assert!(filtered_app_storage(b"[]", &other).is_err());
    }

    fn cc_switch_db(path: &Path, root: &str) {
        let conn = Connection::open(path).unwrap();
        conn.execute_batch(
            "CREATE TABLE session_log_sync (file_path TEXT PRIMARY KEY);
             CREATE TABLE proxy_request_logs (request_id TEXT PRIMARY KEY, session_id TEXT, data_source TEXT);
             CREATE TABLE session_usage_dedup (data_source TEXT, request_id TEXT, PRIMARY KEY (data_source, request_id));
             CREATE TABLE usage_daily_rollups (date TEXT, request_count INTEGER);
             INSERT INTO usage_daily_rollups VALUES ('2026-11-20', 3);",
        )
        .unwrap();
        for (store, id) in [(root, TARGET), (root, FORK), ("/other/antigravity", TARGET)] {
            conn.execute(
                "INSERT INTO session_log_sync VALUES (?1)",
                [format!(
                    "agy:{store}/brain/{id}/.system_generated/logs/transcript_full.jsonl"
                )],
            )
            .unwrap();
        }
        for (source, id) in [
            ("agy_session", TARGET),
            ("agy_session", FORK),
            ("codex_session", TARGET),
        ] {
            for step in [1, 2] {
                let request = format!("agy:{id}:{step}");
                conn.execute(
                    "INSERT INTO proxy_request_logs VALUES (?1, ?2, ?3)",
                    [
                        format!("{source}/{request}"),
                        id.to_owned(),
                        source.to_owned(),
                    ],
                )
                .unwrap();
                conn.execute(
                    "INSERT INTO session_usage_dedup VALUES (?1, ?2)",
                    [source.to_owned(), request],
                )
                .unwrap();
            }
        }
    }

    fn rows(path: &Path, sql: &str) -> Vec<String> {
        let conn = Connection::open(path).unwrap();
        let mut statement = conn.prepare(sql).unwrap();
        statement
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<rusqlite::Result<_>>()
            .unwrap()
    }

    #[test]
    fn forgets_cc_switch_sync_progress_but_keeps_usage_when_asked() {
        let home = tempfile::tempdir().unwrap();
        let home = home.path();
        let root = home.join(".gemini/antigravity");
        let backups = home.join(CC_SWITCH_BACKUPS);
        fs::create_dir_all(&backups).unwrap();
        let databases = [home.join(CC_SWITCH_DB), backups.join("db_backup_1.db")];
        for path in &databases {
            cc_switch_db(path, &root.to_string_lossy());
        }
        fs::write(backups.join("notes.txt"), TARGET).unwrap();
        let cleaned = [Cleaned {
            root: root.clone(),
            ids: ids(&[TARGET]),
        }];

        let skipped = CleanOptions::default();
        assert!(run(home, &cleaned, skipped).is_empty());
        assert_eq!(
            rows(&databases[0], "SELECT file_path FROM session_log_sync").len(),
            3
        );

        let options = CleanOptions {
            cc_switch: true,
            ..CleanOptions::default()
        };
        assert_eq!(run(home, &cleaned, options), Vec::<String>::new());
        for path in &databases {
            let logs = rows(path, "SELECT file_path FROM session_log_sync ORDER BY 1");
            assert_eq!(logs.len(), 2);
            assert!(logs.iter().any(|path| path.contains(FORK)));
            assert!(logs.iter().any(|path| path.starts_with("agy:/other/")));
            assert_eq!(
                rows(path, "SELECT request_id FROM proxy_request_logs").len(),
                6
            );
            assert_eq!(
                rows(path, "SELECT request_id FROM session_usage_dedup").len(),
                6
            );
            assert_eq!(rows(path, "SELECT date FROM usage_daily_rollups").len(), 1);
        }
        assert_eq!(
            fs::read_to_string(backups.join("notes.txt")).unwrap(),
            TARGET
        );
    }

    #[test]
    fn cleans_app_window_state_and_empties_caches_only_when_asked() {
        let home = tempfile::tempdir().unwrap();
        let home = home.path();
        let app = home.join(APP_DATA);
        for name in APP_CACHES {
            fs::create_dir_all(app.join(name).join("js")).unwrap();
            fs::write(app.join(name).join("js").join("entry"), TARGET).unwrap();
        }
        fs::write(app.join(APP_STORAGE), app_storage()).unwrap();
        fs::write(app.join("Preferences"), "{}").unwrap();
        let cleaned = [Cleaned {
            root: home.join(".gemini/antigravity"),
            ids: ids(&[TARGET]),
        }];

        assert!(run(home, &cleaned, CleanOptions::default()).is_empty());
        assert!(!fs::read_to_string(app.join(APP_STORAGE))
            .unwrap()
            .contains(TARGET));
        assert!(APP_CACHES.iter().all(|name| app.join(name).is_dir()));

        let options = CleanOptions {
            app_cache: true,
            ..CleanOptions::default()
        };
        assert!(run(home, &cleaned, options).is_empty());
        assert!(APP_CACHES.iter().all(|name| !app.join(name).exists()));
        assert!(app.join("Preferences").is_file());
        // Missing folders are not an error
        assert!(run(home, &cleaned, options).is_empty());
    }
}
