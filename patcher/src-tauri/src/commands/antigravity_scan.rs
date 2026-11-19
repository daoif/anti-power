use super::antigravity_clean::{index_name, indexed_ids};
use super::antigravity_store::{
    checked_path, locate, roots, valid_id, DESKTOP, INDEX_DB, METADATA,
};
use super::sessions::{SessionMessage, SessionMeta};
use rusqlite::{types::ValueRef, Connection, OpenFlags, Row};
use serde_json::Value;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs::{self, File, Metadata};
use std::io::{self, BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const TRANSCRIPT: &str = ".system_generated/logs/transcript_full.jsonl";
const PREVIEW_BYTES: u64 = 128 * 1024;

#[derive(Default)]
struct Candidate {
    title: Option<String>,
    summary: Option<String>,
    project_dir: Option<String>,
    indexed_at: Option<u64>,
    file_at: Option<SystemTime>,
}

type Candidates = BTreeMap<String, Candidate>;
type Parents = HashMap<String, String>;

pub(super) fn scan(home: &Path, provider_id: &str) -> Result<Vec<SessionMeta>, String> {
    let mut sessions = Vec::new();
    for root in roots(home, provider_id).map_err(|error| error.to_string())? {
        if checked_root(home, &root).is_err() {
            continue;
        }
        let mut candidates = Candidates::new();
        let mut parents = Parents::new();
        if let Ok(Some(path)) = checked_path(&root, Path::new(INDEX_DB)) {
            if let Ok(db) = open_db(&path) {
                read_index(&db, &mut candidates, &mut parents);
            }
        }
        read_metadata(&root, &mut candidates);
        if let Ok(Some(path)) = checked_path(&root, Path::new(index_name(provider_id))) {
            for id in indexed_ids(&fs::read(path).unwrap_or_default(), provider_id == DESKTOP) {
                candidates.entry(id).or_default();
            }
        }
        collect_files(&root, &mut candidates);

        let hidden: HashSet<_> = candidates
            .keys()
            .filter(|id| covered_by_parent(id, &candidates, &parents))
            .cloned()
            .collect();
        for (id, mut candidate) in candidates {
            if hidden.contains(&id) {
                continue;
            }
            if candidate.title.is_none() {
                if let Ok(Some(file)) = open_transcript(&root, &id) {
                    let preview =
                        read_messages(BufReader::new(file.take(PREVIEW_BYTES))).unwrap_or_default();
                    if let Some(message) = preview.iter().find(|message| message.role == "user") {
                        candidate.title = Some(shorten(&message.content, 80));
                        candidate
                            .summary
                            .get_or_insert_with(|| shorten(&message.content, 160));
                    }
                }
            }
            let source_path = conversation_path(&root, &id).to_string_lossy().into_owned();
            sessions.push(SessionMeta {
                provider_id: provider_id.to_owned(),
                session_id: id,
                title: candidate.title,
                summary: candidate.summary,
                project_dir: candidate.project_dir,
                last_active_at: candidate
                    .indexed_at
                    .or_else(|| candidate.file_at.and_then(epoch_millis)),
                source_path,
                index_only: candidate.file_at.is_none(),
            });
        }
    }
    Ok(sessions)
}

pub(super) fn load_messages(
    home: &Path,
    provider_id: &str,
    source_path: &Path,
) -> Result<Vec<SessionMessage>, String> {
    let (root, id) = locate(home, provider_id, source_path)?;
    let result = (|| {
        checked_root(home, &root)?;
        match open_transcript(&root, &id)? {
            Some(file) => read_messages(BufReader::new(file)),
            None => Ok(Vec::new()),
        }
    })();
    result.map_err(|error| error.to_string())
}

fn checked_root(home: &Path, root: &Path) -> io::Result<()> {
    let relative = root
        .strip_prefix(home)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidInput, error))?;
    if checked_path(home, relative)?.is_some_and(|path| path.is_dir()) {
        Ok(())
    } else {
        Err(io::Error::new(
            io::ErrorKind::NotFound,
            "Antigravity store not found",
        ))
    }
}

fn conversation_path(root: &Path, id: &str) -> PathBuf {
    root.join("conversations").join(format!("{id}.db"))
}

fn open_transcript(root: &Path, id: &str) -> io::Result<Option<File>> {
    let relative = Path::new("brain").join(id).join(TRANSCRIPT);
    match checked_path(root, &relative)? {
        Some(path) if fs::symlink_metadata(&path)?.is_file() => File::open(path).map(Some),
        _ => Ok(None),
    }
}

fn open_db(path: &Path) -> Result<Connection, rusqlite::Error> {
    for entry in [
        path.to_path_buf(),
        path.with_extension("db-wal"),
        path.with_extension("db-shm"),
        path.with_extension("db-journal"),
    ] {
        match fs::symlink_metadata(entry) {
            Ok(metadata) if metadata.is_file() => {}
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            _ => return Err(rusqlite::Error::InvalidPath(path.to_path_buf())),
        }
    }
    let canonical_path = path
        .canonicalize()
        .map_err(|_| rusqlite::Error::InvalidPath(path.to_path_buf()))?;
    let db = Connection::open_with_flags(
        canonical_path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NOFOLLOW,
    )?;
    db.busy_timeout(Duration::from_millis(100))?;
    Ok(db)
}

fn read_index(db: &Connection, candidates: &mut Candidates, parents: &mut Parents) {
    if let Ok(mut query) = db.prepare("SELECT * FROM conversation_summaries") {
        if let Ok(mut rows) = query.query([]) {
            while let Ok(Some(row)) = rows.next() {
                let Ok(id) = row.get::<_, String>("conversation_id") else {
                    continue;
                };
                if valid_id(&id) {
                    if row
                        .get::<_, i64>("nesting_depth")
                        .is_ok_and(|depth| depth > 0)
                    {
                        if let Ok(parent) = row.get::<_, String>("parent_conversation_id") {
                            if valid_id(&parent) && id != parent {
                                parents.insert(id.clone(), parent);
                            }
                        }
                    }
                    let candidate = candidates.entry(id).or_default();
                    candidate.title = index_text(row, "title")
                        .as_deref()
                        .and_then(user_text)
                        .map(|text| shorten(text, 120));
                    candidate.summary = index_text(row, "preview")
                        .as_deref()
                        .and_then(user_text)
                        .map(|text| shorten(text, 160));
                    candidate.project_dir = index_text(row, "workspace_uris")
                        .as_deref()
                        .and_then(workspace_dir);
                    candidate.indexed_at = index_time(row, "last_modified_time");
                }
            }
        }
    }
    if let Ok(mut query) = db.prepare("SELECT DISTINCT conversation_id FROM conversations_fts") {
        if let Ok(rows) = query.query_map([], |row| row.get::<_, String>(0)) {
            for id in rows.flatten().filter(|id| valid_id(id)) {
                candidates.entry(id).or_default();
            }
        }
    }
}

// The CLI caches summaries for conversations that its index may not list
fn read_metadata(root: &Path, candidates: &mut Candidates) {
    let Ok(Some(path)) = checked_path(root, Path::new(METADATA)) else {
        return;
    };
    let Ok(bytes) = fs::read(path) else { return };
    let Ok(value) = serde_json::from_slice::<Value>(&bytes) else {
        return;
    };
    let Some(entries) = value["conversations"].as_object() else {
        return;
    };
    for (id, entry) in entries.iter().filter(|(id, _)| valid_id(id)) {
        let summary = &entry["summary"];
        let text = |name: &str, max_chars| {
            summary[name]
                .as_str()
                .and_then(user_text)
                .map(|text| shorten(text, max_chars))
        };
        let candidate = candidates.entry(id.clone()).or_default();
        candidate.title = candidate.title.take().or_else(|| text("Title", 120));
        candidate.summary = candidate.summary.take().or_else(|| text("Preview", 160));
        candidate.project_dir = candidate.project_dir.take().or_else(|| {
            let uris = summary["WorkspaceURIs"].as_array()?;
            uris.iter()
                .filter_map(Value::as_str)
                .find_map(file_uri_path)
        });
        candidate.indexed_at = candidate.indexed_at.or_else(|| {
            // A zero or unreadable time must not hide the next field
            ["last_modified_time", "UpdatedAt"]
                .into_iter()
                .flat_map(|name| [&entry[name], &summary[name]])
                .find_map(|time| time.as_str().and_then(parse_time))
        });
    }
}

fn index_text(row: &Row<'_>, name: &str) -> Option<String> {
    let value = row.get::<_, String>(name).ok()?;
    (!value.trim().is_empty()).then_some(value)
}

fn index_time(row: &Row<'_>, name: &str) -> Option<u64> {
    match row.get_ref(name).ok()? {
        ValueRef::Integer(value) => numeric_time(value as f64),
        ValueRef::Real(value) => numeric_time(value),
        ValueRef::Text(value) => parse_time(std::str::from_utf8(value).ok()?),
        _ => None,
    }
}

fn workspace_dir(value: &str) -> Option<String> {
    let uris = serde_json::from_str::<Vec<String>>(value).ok()?;
    uris.iter().find_map(|uri| file_uri_path(uri))
}

fn file_uri_path(uri: &str) -> Option<String> {
    let path = tauri::Url::parse(uri).ok()?.to_file_path().ok()?;
    Some(path.to_string_lossy().into_owned())
}

fn covered_by_parent(id: &str, candidates: &Candidates, parents: &Parents) -> bool {
    if parents
        .get(id)
        .is_none_or(|parent| !candidates.contains_key(parent))
    {
        return false;
    }
    let mut ancestors = HashSet::new();
    let mut current = id;
    while let Some(parent) = parents.get(current) {
        if !ancestors.insert(current) {
            return false;
        }
        current = parent;
    }
    true
}

fn collect_files(root: &Path, candidates: &mut Candidates) {
    for dir in ["conversations", "annotations", "brain"] {
        let Ok(Some(path)) = checked_path(root, Path::new(dir)) else {
            continue;
        };
        let Ok(entries) = fs::read_dir(path) else {
            continue;
        };
        for entry in entries.flatten() {
            let name = entry.file_name();
            let Some(name) = name.to_str() else { continue };
            let path = entry.path();
            let (id, modified) = match dir {
                "brain" if valid_id(name) => (name, artifact_tree_time(&path)),
                "annotations" => (
                    name.strip_suffix(".pbtxt").unwrap_or_default(),
                    nonempty_file_time(&path),
                ),
                "conversations" => conversation_artifact(root, name, &path, candidates),
                _ => continue,
            };
            if valid_id(id) {
                if let Some(modified) = modified {
                    let candidate = candidates.entry(id.to_owned()).or_default();
                    candidate.file_at = candidate.file_at.max(Some(modified));
                }
            }
        }
    }
}

fn conversation_artifact<'a>(
    root: &Path,
    name: &'a str,
    path: &Path,
    candidates: &Candidates,
) -> (&'a str, Option<SystemTime>) {
    let Some((id, extension)) = name.split_once('.') else {
        return ("", None);
    };
    if !valid_id(id) {
        return ("", None);
    }
    let modified = match extension {
        "pb" => nonempty_file_time(path),
        "db" => nonempty_file_time(path).filter(|_| {
            candidates.contains_key(id)
                || open_db(path)
                    .and_then(|db| has_conversation_data(&db))
                    .unwrap_or(true)
        }),
        "db-wal" | "db-shm" | "db-journal"
            if nonempty_file_time(&conversation_path(root, id)).is_none() =>
        {
            nonempty_file_time(path)
        }
        _ => None,
    };
    let modified = if extension == "db" && modified.is_some() {
        modified.max(nonempty_file_time(&path.with_extension("db-wal")))
    } else {
        modified
    };
    (id, modified)
}

fn has_conversation_data(db: &Connection) -> rusqlite::Result<bool> {
    let mut tables = db.prepare(
        "SELECT name FROM sqlite_schema WHERE type = 'table' AND name IN ('steps', 'gen_metadata')",
    )?;
    let tables = tables.query_map([], |row| row.get::<_, String>(0))?;
    for table in tables {
        let sql = match table?.as_str() {
            "steps" => "SELECT EXISTS(SELECT 1 FROM steps)",
            "gen_metadata" => "SELECT EXISTS(SELECT 1 FROM gen_metadata)",
            _ => continue,
        };
        if db.query_row(sql, [], |row| row.get::<_, bool>(0))? {
            return Ok(true);
        }
    }
    Ok(false)
}

fn nonempty_file_time(path: &Path) -> Option<SystemTime> {
    let metadata = fs::symlink_metadata(path).ok()?;
    (metadata.is_file() && metadata.len() > 0).then(|| modified_time(&metadata))
}

fn artifact_tree_time(path: &Path) -> Option<SystemTime> {
    let mut dirs = vec![path.to_path_buf()];
    let mut latest = None;
    while let Some(path) = dirs.pop() {
        if !fs::symlink_metadata(&path)
            .ok()
            .is_some_and(|metadata| metadata.is_dir())
        {
            continue;
        }
        if let Ok(entries) = fs::read_dir(path) {
            for entry in entries.flatten() {
                let Ok(kind) = entry.file_type() else {
                    continue;
                };
                if kind.is_dir() {
                    dirs.push(entry.path());
                } else if kind.is_file() {
                    latest = latest.max(nonempty_file_time(&entry.path()));
                }
            }
        }
    }
    latest
}

fn modified_time(metadata: &Metadata) -> SystemTime {
    metadata.modified().unwrap_or(UNIX_EPOCH)
}

fn epoch_millis(time: SystemTime) -> Option<u64> {
    let elapsed = time.duration_since(UNIX_EPOCH).ok()?;
    u64::try_from(elapsed.as_millis()).ok()
}

fn read_messages(reader: impl BufRead) -> io::Result<Vec<SessionMessage>> {
    let mut indexed_steps = BTreeMap::new();
    let mut slots = Vec::new();
    for line in reader.lines() {
        let line = match line {
            Ok(line) => line,
            Err(error) if error.kind() == io::ErrorKind::InvalidData => continue,
            Err(error) => return Err(error),
        };
        let Ok(row) = serde_json::from_str::<Value>(&line) else {
            continue;
        };
        let message = visible_message(&row);
        if let Some(index) = row["step_index"].as_u64() {
            if indexed_steps.insert(index, message).is_none() {
                slots.push(None);
            }
        } else if message.is_some() {
            slots.push(message);
        }
    }
    // Rewrite indexed steps in order while retaining messages without indices
    let mut steps = indexed_steps.into_values();
    Ok(slots
        .into_iter()
        .filter_map(|slot| slot.or_else(|| steps.next().flatten()))
        .collect())
}

fn visible_message(row: &Value) -> Option<SessionMessage> {
    let nested = row
        .get("message")
        .filter(|message| message.is_object())
        .unwrap_or(row);
    let role = match row["type"].as_str() {
        Some("USER_INPUT" | "user") => "user",
        Some("PLANNER_RESPONSE" | "assistant") => "assistant",
        None | Some("message" | "MESSAGE") => {
            match nested["role"].as_str().or(row["role"].as_str())? {
                "user" => "user",
                "assistant" | "model" => "assistant",
                _ => return None,
            }
        }
        _ => return None,
    };
    let content = nested
        .get("content")
        .or_else(|| nested.get("parts"))
        .or_else(|| nested.get("text"))
        .or_else(|| row.get("content"))
        .or_else(|| row.get("message").filter(|value| value.is_string()))?;
    let content = visible_text(content);
    let content = if role == "user" {
        user_text(&content)?
    } else {
        &content
    };
    if content.trim().is_empty() {
        return None;
    }
    Some(SessionMessage {
        role: role.to_owned(),
        content: content.to_owned(),
        ts: [row, nested].into_iter().find_map(|value| {
            ["created_at", "timestamp"].into_iter().find_map(|key| {
                let field = &value[key];
                field
                    .as_str()
                    .and_then(parse_time)
                    .or_else(|| field.as_f64().and_then(numeric_time))
            })
        }),
    })
}

fn visible_text(content: &Value) -> String {
    fn text_part(part: &Value) -> Option<&str> {
        if part["thought"].as_bool() == Some(true) {
            return None;
        }
        match part["type"].as_str() {
            None | Some("text" | "input_text" | "output_text") => part
                .as_str()
                .or_else(|| part["text"].as_str())
                .or_else(|| part["input_text"].as_str())
                .or_else(|| part["output_text"].as_str()),
            _ => None,
        }
    }
    match content.as_array().or_else(|| content["parts"].as_array()) {
        Some(parts) => parts
            .iter()
            .filter_map(text_part)
            .collect::<Vec<_>>()
            .join("\n"),
        None => text_part(content).unwrap_or_default().to_owned(),
    }
}

fn user_text(content: &str) -> Option<&str> {
    if let Some((_, rest)) = content.split_once("<USER_REQUEST>") {
        return rest
            .split_once("</USER_REQUEST>")
            .map(|(request, _)| request.trim())
            .filter(|request| !request.is_empty());
    }
    let end = [
        "<ADDITIONAL_METADATA>",
        "<USER_SETTINGS_CHANGE>",
        "<SYSTEM_CONTEXT>",
        "<SYSTEM_REMINDER>",
    ]
    .into_iter()
    .filter_map(|tag| content.find(tag))
    .min()
    .unwrap_or(content.len());
    let text = content[..end].trim();
    (!text.is_empty()).then_some(text)
}

fn shorten(text: &str, max_chars: usize) -> String {
    match text.char_indices().nth(max_chars) {
        Some((end, _)) => format!("{}…", &text[..end]),
        None => text.to_owned(),
    }
}

fn numeric_time(value: f64) -> Option<u64> {
    let millis = if value < 100_000_000_000.0 {
        value * 1000.0
    } else {
        value
    };
    (millis.is_finite() && millis >= 0.0 && millis < u64::MAX as f64).then_some(millis as u64)
}

fn parse_time(text: &str) -> Option<u64> {
    let text = text.trim();
    if let Ok(value) = text.parse::<f64>() {
        return numeric_time(value);
    }
    let (date, clock) = text.split_once(['T', ' '])?;
    let mut date = date.split('-').map(str::parse::<i64>);
    let year = date.next()?.ok()?;
    let month = date.next()?.ok()?;
    let day = date.next()?.ok()?;
    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let month_days = [
        31,
        if leap { 29 } else { 28 },
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];
    if !(1..=9999).contains(&year)
        || !(1..=12).contains(&month)
        || !(1..=month_days[(month - 1) as usize]).contains(&day)
        || date.next().is_some()
    {
        return None;
    }
    let (clock, offset) = if let Some((clock, sign)) = clock.split_once(['+', '-']) {
        let (hours, minutes) = sign.split_once(':')?;
        let offset = clock_seconds(hours.parse().ok()?, minutes.parse().ok()?, 0)?;
        let sign = text.as_bytes()[text.len() - sign.len() - 1];
        (clock, if sign == b'-' { -offset } else { offset })
    } else {
        (clock.strip_suffix('Z').unwrap_or(clock), 0)
    };
    let (clock, fraction) = clock.split_once('.').unwrap_or((clock, ""));
    let mut parts = clock.split(':').map(str::parse::<i64>);
    let seconds = clock_seconds(
        parts.next()?.ok()?,
        parts.next()?.ok()?,
        parts.next()?.ok()?,
    )?;
    if parts.next().is_some() || !fraction.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    let millis = fraction
        .bytes()
        .chain([b'0'; 3])
        .take(3)
        .fold(0, |sum, digit| sum * 10 + i64::from(digit - b'0'));
    let year = year - i64::from(month <= 2);
    let month = if month <= 2 { month + 9 } else { month - 3 };
    let days =
        365 * year + year / 4 - year / 100 + year / 400 + (153 * month + 2) / 5 + day - 719469;
    u64::try_from((days * 86400 + seconds - offset) * 1000 + millis).ok()
}

fn clock_seconds(hour: i64, minute: i64, second: i64) -> Option<i64> {
    if !(0..24).contains(&hour) || !(0..60).contains(&minute) || !(0..60).contains(&second) {
        return None;
    }
    Some(hour * 3600 + minute * 60 + second)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;

    const PARENT: &str = "856cc87c-870e-4263-a285-d76de34c9910";
    const AGENT: &str = "856cc87c-870e-4263-a285-d76de34c9911";
    const FORK: &str = "856cc87c-870e-4263-a285-d76de34c9912";
    const ORPHAN: &str = "856cc87c-870e-4263-a285-d76de34c9913";
    const MISSING: &str = "856cc87c-870e-4263-a285-d76de34c9914";

    fn create_index(root: &Path) -> Connection {
        fs::create_dir_all(root).unwrap();
        let db = Connection::open(root.join(INDEX_DB)).unwrap();
        db.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA wal_autocheckpoint = 0;
             CREATE TABLE conversation_summaries (
                 conversation_id TEXT PRIMARY KEY, title TEXT, preview TEXT,
                 workspace_uris TEXT, last_modified_time TEXT, step_count INTEGER,
                 nesting_depth INTEGER, parent_conversation_id TEXT
             );
             CREATE TABLE conversation_parents (conversation_id TEXT, parent_id TEXT);",
        )
        .unwrap();
        db
    }

    fn insert_summary(db: &Connection, id: &str, title: &str, depth: i64, parent: Option<&str>) {
        db.execute(
            "INSERT INTO conversation_summaries VALUES (
                 ?1, ?2, NULL, '[\"file:///tmp/sample%20project\"]', '2026-10-13T17:26:12.345+01:00',
                 0, ?3, ?4
             )",
            params![id, title, depth, parent],
        ).unwrap();
    }

    #[test]
    fn keeps_zero_step_wal_index_rows_in_each_source() {
        let home = tempfile::tempdir().unwrap();
        let home = home.path();
        let desktop = home.join(".gemini/antigravity");
        let cli = home.join(".gemini/antigravity-cli");
        let profile = home.join(".cc-switch/agy/alternate/antigravity-cli");
        let nested = home.join(".cc-switch/agy/wrong/nested/antigravity-cli");
        let stores = [
            (&desktop, "Desktop"),
            (&cli, "CLI"),
            (&profile, "Profile"),
            (&nested, "Wrong Path"),
        ];
        let _writers: Vec<_> = stores
            .into_iter()
            .map(|(root, title)| {
                let db = create_index(root);
                insert_summary(&db, PARENT, title, 0, None);
                insert_summary(&db, "invalid-id", "Invalid", 0, None);
                db
            })
            .collect();

        let desktop_rows = scan(home, "antigravity").unwrap();
        let cli_rows = scan(home, "agy").unwrap();
        assert_eq!(desktop_rows.len(), 1);
        assert_eq!(cli_rows.len(), 2);
        for (row, root, title) in [
            (&desktop_rows[0], &desktop, "Desktop"),
            (&cli_rows[0], &cli, "CLI"),
            (&cli_rows[1], &profile, "Profile"),
        ] {
            assert_eq!(row.session_id, PARENT);
            assert_eq!(row.title.as_deref(), Some(title));
            assert_eq!(row.last_active_at, Some(1_791_908_772_345));
            assert!(row.index_only);
            let source = Path::new(&row.source_path);
            assert_eq!(source, conversation_path(root, PARENT));
            assert!(!source.exists());
            assert!(load_messages(home, &row.provider_id, source)
                .unwrap()
                .is_empty());
        }
        assert!(load_messages(home, "agy", Path::new(&desktop_rows[0].source_path)).is_err());

        let transcript = profile.join("brain").join(PARENT).join(TRANSCRIPT);
        fs::create_dir_all(transcript.parent().unwrap()).unwrap();
        fs::write(&transcript, r#"{"role":"user","content":"Profile prompt"}"#).unwrap();
        let profile_messages =
            load_messages(home, "agy", Path::new(&cli_rows[1].source_path)).unwrap();
        assert_eq!(profile_messages[0].content, "Profile prompt");
        assert!(
            load_messages(home, "agy", Path::new(&cli_rows[0].source_path))
                .unwrap()
                .is_empty()
        );
    }

    #[test]
    fn ignores_a_cc_switch_profile_path_that_is_not_a_directory() {
        let home = tempfile::tempdir().unwrap();
        fs::create_dir(home.path().join(".cc-switch")).unwrap();
        fs::write(home.path().join(".cc-switch/agy"), []).unwrap();
        assert!(scan(home.path(), "agy").unwrap().is_empty());
    }

    #[test]
    fn hides_only_linked_nested_agents_in_the_same_store() {
        let home = tempfile::tempdir().unwrap();
        let root = home.path().join(".gemini/antigravity-cli");
        let db = create_index(&root);
        for (id, depth, parent) in [
            (PARENT, 0, None),
            (AGENT, 1, Some(PARENT)),
            (FORK, 0, Some(PARENT)),
            (ORPHAN, 2, Some(MISSING)),
        ] {
            insert_summary(&db, id, "Synthetic", depth, parent);
            if let Some(parent) = parent {
                db.execute(
                    "INSERT INTO conversation_parents VALUES (?1, ?2)",
                    [id, parent],
                )
                .unwrap();
            }
        }
        let desktop = create_index(&home.path().join(".gemini/antigravity"));
        insert_summary(&desktop, MISSING, "Parent in a different store", 0, None);

        let rows = scan(home.path(), "agy").unwrap();
        let ids: Vec<_> = rows.iter().map(|row| row.session_id.as_str()).collect();
        assert_eq!(ids, [PARENT, FORK, ORPHAN]);
    }

    #[test]
    fn lists_records_that_only_the_cli_metadata_cache_holds() {
        let home = tempfile::tempdir().unwrap();
        let root = home.path().join(".gemini/antigravity-cli");
        let db = create_index(&root);
        insert_summary(&db, PARENT, "Indexed title", 0, None);
        fs::create_dir_all(root.join("cache")).unwrap();
        let entry = |title: &str| {
            serde_json::json!({
                "summary": {"Title": title, "WorkspaceURIs": ["file:///tmp/cached"]},
                "last_modified_time": "1970-01-01T00:00:02Z",
            })
        };
        fs::write(
            root.join(METADATA),
            serde_json::json!({"conversations": {
                PARENT: entry("Cached title"),
                ORPHAN: entry("Cached only"),
                "invalid-id": entry("Invalid"),
            }})
            .to_string(),
        )
        .unwrap();

        let rows = scan(home.path(), "agy").unwrap();
        let found: Vec<_> = rows
            .iter()
            .map(|row| (row.session_id.as_str(), row.title.as_deref().unwrap()))
            .collect();
        assert_eq!(found, [(PARENT, "Indexed title"), (ORPHAN, "Cached only")]);
        assert_eq!(rows[1].last_active_at, Some(2_000));
        assert_eq!(rows[1].project_dir.is_some(), cfg!(unix));
    }

    #[test]
    fn keeps_database_wal_and_legacy_payloads_but_skips_shells() {
        let home = tempfile::tempdir().unwrap();
        let root = home.path().join(".gemini/antigravity");
        let conversations = root.join("conversations");
        fs::create_dir_all(&conversations).unwrap();
        fs::create_dir_all(root.join("brain").join(ORPHAN).join("empty")).unwrap();

        let active = Connection::open(conversation_path(&root, PARENT)).unwrap();
        active
            .execute_batch(
                "PRAGMA journal_mode = WAL;
             PRAGMA wal_autocheckpoint = 0;
             CREATE TABLE steps (idx INTEGER, data BLOB);
             INSERT INTO steps VALUES (0, x'1234');",
            )
            .unwrap();
        let shell = Connection::open(conversation_path(&root, AGENT)).unwrap();
        shell
            .execute_batch("CREATE TABLE steps (idx INTEGER, data BLOB);")
            .unwrap();
        fs::write(conversations.join(format!("{FORK}.pb")), [2, 1, 0]).unwrap();
        fs::write(conversation_path(&root, ORPHAN), []).unwrap();

        let rows = scan(home.path(), "antigravity").unwrap();
        let ids: HashSet<_> = rows.iter().map(|row| row.session_id.as_str()).collect();
        assert_eq!(ids, HashSet::from([PARENT, FORK]));
        assert!(rows.iter().all(|row| !row.index_only));
        assert!(load_messages(
            home.path(),
            "antigravity",
            &conversation_path(&root, PARENT)
        )
        .unwrap()
        .is_empty());
    }

    #[test]
    fn loads_only_visible_turns_and_uses_latest_indexed_step() {
        let home = tempfile::tempdir().unwrap();
        let root = home.path().join(".gemini/antigravity-cli");
        let transcript = root.join("brain").join(PARENT).join(TRANSCRIPT);
        fs::create_dir_all(transcript.parent().unwrap()).unwrap();
        fs::write(&transcript, r#"{"type":"PLANNER_RESPONSE","step_index":1,"content":"draft"}
{"type":"USER_INPUT","step_index":0,"content":"<USER_REQUEST>\nSynthetic prompt\n</USER_REQUEST>\n<ADDITIONAL_METADATA>Hidden context</ADDITIONAL_METADATA>","created_at":"1970-01-01T02:00:01.234+02:00"}
{"type":"TOOL_RESULT","step_index":2,"source":"MODEL","content":"Hidden event"}
{"type":"PLANNER_RESPONSE","step_index":1,"content":"Finished reply"}
{"type":"message","message":{"role":"user","content":[{"type":"input_text","text":"Follow up"},{"type":"tool_result","text":"Hidden block"}]}}
{"role":"assistant","parts":[{"text":"Hidden reasoning","thought":true},{"text":"Follow-up reply"}]}
{"role":"system","content":"Hidden system prompt"}
{"type":"USER_INPUT","content":"<ADDITIONAL_METADATA>Hidden notice"}
{"type":"PLANNER_RESPONSE","step_index":3,"content":"Redacted draft"}
{"type":"TOOL_CALL","step_index":3}
{"type":"USER_INPUT","content":"<USER_REQUEST>Unclosed wrapper"}
{"type":"PLANNER_RESPONSE","step_index":4,
"#).unwrap();

        let rows = scan(home.path(), "agy").unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].title.as_deref(), Some("Synthetic prompt"));
        let messages = load_messages(home.path(), "agy", Path::new(&rows[0].source_path)).unwrap();
        let turns: Vec<_> = messages
            .iter()
            .map(|message| (message.role.as_str(), message.content.as_str()))
            .collect();
        assert_eq!(
            turns,
            [
                ("user", "Synthetic prompt"),
                ("assistant", "Finished reply"),
                ("user", "Follow up"),
                ("assistant", "Follow-up reply"),
            ]
        );
        assert_eq!(messages[0].ts, Some(1_234));
    }
}
