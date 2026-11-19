use super::antigravity_store::{
    checked_path, locate, roots, valid_id, DESKTOP, INDEX_DB, METADATA,
};
use super::sessions::SessionRef;
use rusqlite::{Connection, OpenFlags, OptionalExtension, TransactionBehavior};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::Duration;
use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};

const STAGE_PREFIX: &str = ".anti-power-clean-";
const PREPARE_PREFIX: &str = ".anti-power-prepare-";
const PURGE_PREFIX: &str = ".anti-power-purge-";
const COMMIT_TABLE: &str = "anti_power_cleanup_commits";
const PLAN: &str = "plan.json";
const LOCK: &str = ".anti-power-clean.lock";
const DESKTOP_INDEX: &str = "agyhub_summaries_proto.pb";
const CLI_INDEX: &str = "jetbox_summaries_proto.pb";
const RECENTS: &str = "cache/last_conversations.json";
const HISTORY: &str = "history.jsonl";
type Filter = fn(&[u8], &BTreeSet<String>) -> Result<Option<Vec<u8>>>;
type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;

// A failure that every session in the store would hit again
#[derive(Debug)]
struct StoreWide(String);

impl std::fmt::Display for StoreWide {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for StoreWide {}

fn store_wide(error: impl ToString) -> Box<dyn std::error::Error> {
    Box::new(StoreWide(error.to_string()))
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum Client {
    AppOrCli,
    Ide,
}

/// Delete sessions and return the error for each one that could not be removed
pub(super) fn delete(home: &Path, sessions: &[SessionRef]) -> Vec<Option<String>> {
    delete_with(home, sessions, require_clients_closed)
}

fn delete_with(
    home: &Path,
    sessions: &[SessionRef],
    check_clients: impl Fn() -> Result<()>,
) -> Vec<Option<String>> {
    let mut results = vec![None; sessions.len()];
    let mut stores = BTreeMap::<_, Vec<(usize, String)>>::new();
    for (i, session) in sessions.iter().enumerate() {
        match locate_store(home, session) {
            Ok((root, id)) => {
                let store = (root, index_name(&session.provider_id));
                stores.entry(store).or_default().push((i, id));
            }
            Err(error) => results[i] = Some(error),
        }
    }
    if let Err(error) = check_clients() {
        for (i, _) in stores.into_values().flatten() {
            results[i] = Some(error.to_string());
        }
        return results;
    }
    for ((root, index), group) in stores {
        let ids: Vec<&str> = group.iter().map(|(_, id)| id.as_str()).collect();
        let Err(error) = clean(&root, index, &ids, &check_clients) else {
            continue;
        };
        // Retry sessions individually on failure, but skip retries for store-wide errors
        let mut error = (group.len() == 1 || error.is::<StoreWide>()).then(|| error.to_string());
        for (i, id) in &group {
            results[*i] = error.clone().or_else(|| {
                let retry = clean(&root, index, &[id], &check_clients).err()?;
                if retry.is::<StoreWide>() {
                    error = Some(retry.to_string());
                }
                Some(retry.to_string())
            });
        }
    }
    results
}

fn locate_store(
    home: &Path,
    session: &SessionRef,
) -> std::result::Result<(PathBuf, String), String> {
    let (root, id) = locate(home, &session.provider_id, &session.source_path)?;
    if id != session.session_id {
        return Err("Antigravity conversation ID does not match its source".into());
    }
    let relative = root.strip_prefix(home).map_err(|error| error.to_string())?;
    let root = checked_path(home, relative)
        .map_err(|error| error.to_string())?
        .ok_or("Antigravity session store no longer exists")?;
    Ok((root, id))
}

pub(super) fn index_name(provider_id: &str) -> &'static str {
    if provider_id == DESKTOP {
        DESKTOP_INDEX
    } else {
        CLI_INDEX
    }
}

fn require_clients_closed() -> Result<()> {
    let mut system = System::new()?;
    system.refresh_processes_specifics(
        ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::nothing().with_exe(UpdateKind::OnlyIfNotSet),
    );
    if system.processes().is_empty() {
        return Err("Could not verify that Google Antigravity clients are closed".into());
    }
    let mut running = [false; 2];
    for process in system.processes().values() {
        let name = process
            .exe()
            .and_then(Path::file_name)
            .unwrap_or_else(|| process.name());
        let path = process
            .exe()
            .map(|path| path.to_string_lossy())
            .unwrap_or_default();
        if let Some(client) = client(&name.to_string_lossy(), &path) {
            running[client as usize] = true;
        }
    }
    let quit = match running {
        [false, false] => return Ok(()),
        [true, false] => "the Antigravity App and Antigravity CLI",
        [false, true] => "Antigravity IDE",
        [true, true] => "the Antigravity App, Antigravity CLI, and Antigravity IDE",
    };
    Err(format!("Quit {quit} before cleaning sessions").into())
}

// Antigravity IDE is out of scope, but it still blocks cleanup while it runs
fn client(name: &str, path: &str) -> Option<Client> {
    let name = name.to_ascii_lowercase();
    let name = name.trim_end_matches(".exe");
    let path = path.to_ascii_lowercase();
    let helper = (name.starts_with("language_server")
        || matches!(name, "agentapi" | "agy-desktop-helper"))
        && path.contains("antigravity");
    let ide = ["antigravity ide", "antigravity-ide", "antigravity-insiders"];
    if ide.contains(&name)
        || (name == "antigravity" || helper) && ide.iter().any(|ide| path.contains(ide))
    {
        Some(Client::Ide)
    } else if matches!(name, "antigravity" | "agy") || helper {
        Some(Client::AppOrCli)
    } else {
        None
    }
}

fn clean(
    root: &Path,
    index: &str,
    ids: &[&str],
    check_clients: impl Fn() -> Result<()>,
) -> Result<()> {
    check_clients().map_err(store_wide)?;
    with_store_lock(root, |root| {
        let mut connection = open_index(root).map_err(store_wide)?;
        recover_locked(root, connection.as_ref()).map_err(store_wide)?;
        clean_locked(root, index, ids, check_clients, connection.as_mut())
    })
}

/// Finish or undo interrupted cleanups and name the stores that still need attention
pub(super) fn recover_pending(home: &Path, provider_id: &str) -> Vec<String> {
    let mut warnings = Vec::new();
    for root in roots(home, provider_id).unwrap_or_default() {
        let relative = root.strip_prefix(home).unwrap_or(&root);
        let Ok(Some(root)) = checked_path(home, relative) else {
            continue;
        };
        let recover = || -> Result<()> {
            if !root.is_dir() || recovery_dirs(&root)?.is_empty() {
                return Ok(());
            }
            require_clients_closed()?;
            with_store_lock(&root, |root| {
                let connection = open_index(root)?;
                recover_locked(root, connection.as_ref())?;
                compact(connection.as_ref());
                Ok(())
            })
        };
        if let Err(error) = recover() {
            warnings.push(format!("{}: {error}", root.display()));
        }
    }
    warnings
}

fn with_store_lock(root: &Path, action: impl FnOnce(&Path) -> Result<()>) -> Result<()> {
    let lock = || -> Result<(PathBuf, File)> {
        if fs::symlink_metadata(root)?.file_type().is_symlink() {
            return Err("Cannot clean an Antigravity store through a symlink".into());
        }
        let root = root.canonicalize()?;
        // Keep the lock path stable so concurrent callers always lock the same file
        let lock_path = checked_file(&root, LOCK)?.unwrap_or_else(|| root.join(LOCK));
        let lock = fs::OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .open(lock_path)?;
        lock.try_lock()
            .map_err(|error| format!("Cannot lock session cleanup: {error}"))?;
        Ok((root, lock))
    };
    let (root, _lock) = lock().map_err(store_wide)?;
    action(&root)
}

fn clean_locked(
    root: &Path,
    index: &str,
    ids: &[&str],
    check_clients: impl Fn() -> Result<()>,
    connection: Option<&mut Connection>,
) -> Result<()> {
    let mut connection = connection;
    let tx = connection
        .as_mut()
        .map(|conn| conn.transaction_with_behavior(TransactionBehavior::Immediate))
        .transpose()
        .map_err(store_wide)?;
    let ids = related_ids(tx.as_deref(), ids)?;
    let presence = lock_presence(root, &ids)?;
    let files = session_files(root, &ids)?;
    let mut replacements = Vec::new();
    if let Some(path) = checked_file(root, index)? {
        let original = fs::read(&path)?;
        if let Some(filtered) = filtered_index(&original, &ids, index == DESKTOP_INDEX)? {
            replacements.push(Replacement {
                path,
                original,
                filtered,
            });
        }
    }
    let caches: [(&str, Filter); 3] = [
        (RECENTS, filtered_recents),
        (METADATA, filtered_metadata),
        (HISTORY, filtered_history),
    ];
    for (name, filter) in caches {
        if let Some(path) = checked_file(root, name)? {
            let original = fs::read(&path)?;
            if let Some(filtered) = filter(&original, &ids)? {
                replacements.push(Replacement {
                    path,
                    original,
                    filtered,
                });
            }
        }
    }
    if let Some(tx) = &tx {
        remove_index_rows(tx, &ids)?;
    }
    check_clients().map_err(store_wide)?;
    if files.is_empty() && replacements.is_empty() {
        tx.map(rusqlite::Transaction::commit).transpose()?;
        compact(connection.as_deref());
        return Ok(());
    }

    let stage = Stage::prepare(root, files, &replacements, tx.is_some())?;
    let result = (move || -> Result<()> {
        stage.apply(root, &replacements)?;
        check_clients().map_err(store_wide)?;
        stage.commit(tx)
    })();
    drop(presence);

    let recovery = recover_locked(root, connection.as_deref());
    match (result, recovery) {
        (Ok(()), Ok(())) => {
            compact(connection.as_deref());
            Ok(())
        }
        (Err(error), Ok(())) => Err(error),
        (Ok(()), Err(error)) => Err(format!(
            "Cleanup committed, but temporary files could not be removed: {error}"
        )
        .into()),
        (Err(error), Err(recovery)) => Err(format!("{error}. Recovery failed: {recovery}").into()),
    }
}

fn open_index(root: &Path) -> Result<Option<Connection>> {
    let Some(path) = checked_file(root, INDEX_DB)? else {
        return Ok(None);
    };
    for filename in [
        "conversation_summaries.db-wal",
        "conversation_summaries.db-shm",
        "conversation_summaries.db-journal",
    ] {
        checked_file(root, filename)?;
    }
    let conn = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NOFOLLOW,
    )?;
    conn.busy_timeout(Duration::from_secs(2))?;
    // Overwrite deleted rows so their text does not linger in free pages
    conn.pragma_update(None, "secure_delete", true)?;
    Ok(Some(conn))
}

fn has_column(conn: &Connection, table: &str, column: &str) -> rusqlite::Result<bool> {
    conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM pragma_table_info(?1) WHERE name = ?2)",
        [table, column],
        |row| row.get(0),
    )
}

fn related_ids(conn: Option<&Connection>, selected: &[&str]) -> Result<BTreeSet<String>> {
    let mut ids: BTreeSet<_> = selected.iter().map(|id| (*id).to_owned()).collect();
    let Some(conn) = conn else {
        return Ok(ids);
    };
    if !has_column(conn, "conversation_summaries", "nesting_depth")?
        || !has_column(conn, "conversation_summaries", "parent_conversation_id")?
    {
        return Ok(ids);
    }

    // Forks can have a parent too; only nested agent runs are part of the selected conversation
    let mut children = BTreeMap::<String, Vec<String>>::new();
    let mut statement = conn.prepare(
        "SELECT parent_conversation_id, conversation_id FROM conversation_summaries
         WHERE nesting_depth > 0 AND parent_conversation_id != ''",
    )?;
    let rows = statement.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;
    for row in rows {
        let (parent, child) = row?;
        if valid_id(&child) {
            children.entry(parent).or_default().push(child);
        }
    }
    let mut pending: Vec<_> = ids.iter().cloned().collect();
    while let Some(parent) = pending.pop() {
        for child in children.remove(&parent).unwrap_or_default() {
            if ids.insert(child.clone()) {
                pending.push(child);
            }
        }
    }
    Ok(ids)
}

fn remove_index_rows(conn: &Connection, ids: &BTreeSet<String>) -> Result<()> {
    // One statement per table, since the FTS table has no index on the ID
    let ids = serde_json::to_string(ids)?;
    for table in [
        "conversation_summaries",
        "conversations_fts",
        "conversation_parents",
    ] {
        let definition: Option<String> = conn
            .query_row(
                "SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = ?1",
                [table],
                |row| row.get(0),
            )
            .optional()?;
        if let Some(definition) = definition {
            let removed = conn.execute(
                &format!(
                    "DELETE FROM {table} WHERE conversation_id IN
                     (SELECT value FROM json_each(?1))"
                ),
                [&ids],
            )?;
            if removed > 0
                && table == "conversations_fts"
                && definition.to_ascii_lowercase().contains("using fts5")
            {
                // Rebuild the FTS index without enabling a persistent format change
                conn.execute(
                    "INSERT INTO conversations_fts(conversations_fts) VALUES ('rebuild')",
                    [],
                )?;
            }
        }
    }
    Ok(())
}

fn compact(connection: Option<&Connection>) {
    if let Some(conn) = connection {
        // Compact removed rows out of free pages; a reader can defer either step without undoing the deletion
        let _ = conn.execute_batch("VACUUM");
        let _ = conn.query_row("PRAGMA wal_checkpoint(TRUNCATE)", [], |_| Ok(()));
    }
}

fn lock_presence(root: &Path, ids: &BTreeSet<String>) -> Result<Vec<File>> {
    let mut locks = Vec::new();
    for id in ids {
        if let Some(path) = checked_file(root, &format!("presence/{id}.lock"))? {
            let file = fs::OpenOptions::new().read(true).write(true).open(path)?;
            file.try_lock()
                .map_err(|error| format!("Cannot lock conversation {id}: {error}"))?;
            locks.push(file);
        }
    }
    Ok(locks)
}

fn checked_file(root: &Path, relative: &str) -> Result<Option<PathBuf>> {
    let path = checked_path(root, Path::new(relative))?;
    if let Some(path) = &path {
        if !path.is_file() {
            return Err(format!("Expected a file at {}", path.display()).into());
        }
    }
    Ok(path)
}

fn session_files(root: &Path, ids: &BTreeSet<String>) -> Result<Vec<PathBuf>> {
    let mut files = Vec::new();
    for id in ids {
        for relative in session_artifacts(id) {
            if let Some(path) = checked_file(root, &relative)? {
                files.push(path);
            }
        }
        if let Some(path) = checked_path(root, &Path::new("brain").join(id))? {
            if !path.is_dir() {
                return Err(format!("Expected a session directory at {}", path.display()).into());
            }
            files.push(path);
        }
    }
    Ok(files)
}

fn session_artifacts(id: &str) -> [String; 7] {
    [
        format!("conversations/{id}.db"),
        format!("conversations/{id}.db-wal"),
        format!("conversations/{id}.db-shm"),
        format!("conversations/{id}.db-journal"),
        format!("conversations/{id}.pb"),
        format!("annotations/{id}.pbtxt"),
        format!("presence/{id}.lock"),
    ]
}

fn mentions(bytes: &[u8], ids: &BTreeSet<String>) -> bool {
    ids.iter().any(|id| {
        bytes
            .windows(id.len())
            .any(|window| window == id.as_bytes())
    })
}

// A cache in an unknown format blocks cleanup only when it names the conversation
fn unrecognized(bytes: &[u8], ids: &BTreeSet<String>, name: &str) -> Result<Option<Vec<u8>>> {
    if mentions(bytes, ids) {
        return Err(
            format!("A selected conversation is referenced in an unrecognized {name}").into(),
        );
    }
    Ok(None)
}

fn filtered_recents(bytes: &[u8], ids: &BTreeSet<String>) -> Result<Option<Vec<u8>>> {
    let Ok(mut value) = serde_json::from_slice::<BTreeMap<String, String>>(bytes) else {
        return unrecognized(bytes, ids, "recent conversation cache");
    };
    let count = value.len();
    value.retain(|_, id| !ids.contains(id));
    Ok((value.len() != count)
        .then(|| serde_json::to_vec_pretty(&value))
        .transpose()?)
}

fn filtered_metadata(bytes: &[u8], ids: &BTreeSet<String>) -> Result<Option<Vec<u8>>> {
    let mut value: serde_json::Value = serde_json::from_slice(bytes).unwrap_or_default();
    let Some(entries) = value
        .get_mut("conversations")
        .and_then(serde_json::Value::as_object_mut)
    else {
        return unrecognized(bytes, ids, "conversation metadata cache");
    };
    let count = entries.len();
    entries.retain(|id, _| !ids.contains(id));
    Ok((entries.len() != count)
        .then(|| serde_json::to_vec_pretty(&value))
        .transpose()?)
}

// Drop the prompts that the Antigravity CLI recorded for the conversation and keep other lines byte for byte
fn filtered_history(bytes: &[u8], ids: &BTreeSet<String>) -> Result<Option<Vec<u8>>> {
    let mut result = Vec::with_capacity(bytes.len());
    for line in bytes.split_inclusive(|byte| *byte == b'\n') {
        let row = serde_json::from_slice::<serde_json::Value>(line).unwrap_or_default();
        if !row["conversationId"]
            .as_str()
            .is_some_and(|id| ids.contains(id))
        {
            result.extend_from_slice(line);
        }
    }
    Ok((result.len() != bytes.len()).then_some(result))
}

// Filter summary entries while preserving unrelated protobuf fields byte for byte
fn filtered_index(bytes: &[u8], ids: &BTreeSet<String>, desktop: bool) -> Result<Option<Vec<u8>>> {
    let mut result = Vec::with_capacity(bytes.len());
    let invalid = || store_wide("Unrecognized Antigravity summary index format");
    let mut rest = bytes;
    while !rest.is_empty() {
        let (tag, body, raw) = next_field(&mut rest).ok_or_else(invalid)?;
        let key = summary_entry_id(tag, body, desktop).map_err(|()| invalid())?;
        if let Some(id) = key {
            if ids.contains(id) {
                continue;
            }
        } else if mentions(raw, ids) {
            return Err(
                "A selected conversation is referenced in an unsupported summary field".into(),
            );
        }
        result.extend_from_slice(raw);
    }
    Ok((result.len() != bytes.len()).then_some(result))
}

/// List the conversations in a summary index, or none when its layout is unknown
pub(super) fn indexed_ids(bytes: &[u8], desktop: bool) -> Vec<String> {
    let mut ids = Vec::new();
    let mut rest = bytes;
    while !rest.is_empty() {
        let Some((tag, body, _)) = next_field(&mut rest) else {
            return Vec::new();
        };
        match summary_entry_id(tag, body, desktop) {
            Ok(Some(id)) => ids.push(id.to_owned()),
            Ok(None) => {}
            Err(()) => return Vec::new(),
        }
    }
    ids
}

fn summary_entry_id(tag: u64, body: &[u8], desktop: bool) -> std::result::Result<Option<&str>, ()> {
    // The Antigravity App also indexes some conversation IDs in a UUID-to-timestamp map
    match tag {
        10 => map_key(body, 18).map(Some).ok_or(()),
        18 if desktop => Ok(map_key(body, 16)),
        _ => Ok(None),
    }
}

fn map_key(mut entry: &[u8], value_tag: u64) -> Option<&str> {
    let mut key = None;
    let mut value = false;
    while !entry.is_empty() {
        let (tag, body, _) = next_field(&mut entry)?;
        if tag == 10 && key.is_none() {
            let id = std::str::from_utf8(body).ok()?;
            if !valid_id(id) {
                return None;
            }
            key = Some(id);
        } else if tag == value_tag && !value {
            value = true;
        } else {
            return None;
        }
    }
    key.filter(|_| value)
}

fn next_field<'a>(rest: &mut &'a [u8]) -> Option<(u64, &'a [u8], &'a [u8])> {
    let from = *rest;
    let tag = varint(rest)?;
    if tag >> 3 == 0 {
        return None;
    }
    let size = match tag & 7 {
        0 => {
            varint(rest)?;
            0
        }
        1 => 8,
        2 => usize::try_from(varint(rest)?).ok()?,
        5 => 4,
        _ => return None,
    };
    let body = rest.get(..size)?;
    *rest = rest.get(size..)?;
    Some((tag, body, &from[..from.len() - rest.len()]))
}

fn varint(rest: &mut &[u8]) -> Option<u64> {
    let mut value = 0;
    for shift in (0..64).step_by(7) {
        let (byte, tail) = rest.split_first()?;
        *rest = tail;
        if shift == 63 && *byte > 1 {
            return None;
        }
        value |= u64::from(byte & 0x7f) << shift;
        if *byte < 0x80 {
            return Some(value);
        }
    }
    None
}

#[derive(Clone, Copy, PartialEq)]
enum Phase {
    Prepare,
    Active,
    Purge,
}

impl Phase {
    fn prefix(self) -> &'static str {
        match self {
            Self::Prepare => PREPARE_PREFIX,
            Self::Active => STAGE_PREFIX,
            Self::Purge => PURGE_PREFIX,
        }
    }
}

fn recovery_dirs(root: &Path) -> Result<Vec<(Phase, PathBuf)>> {
    let mut dirs = Vec::new();
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let name = entry.file_name();
        let Some(name) = name.to_str() else { continue };
        for phase in [Phase::Prepare, Phase::Active, Phase::Purge] {
            if let Some(suffix) = name.strip_prefix(phase.prefix()) {
                if (suffix.len() == 12 || phase == Phase::Active && suffix.len() == 6)
                    && suffix.bytes().all(|byte| byte.is_ascii_alphanumeric())
                {
                    if !entry.file_type()?.is_dir() {
                        return Err(format!("Invalid cleanup directory: {name}").into());
                    }
                    dirs.push((phase, entry.path()));
                }
                break;
            }
        }
    }
    Ok(dirs)
}

fn recover_locked(root: &Path, connection: Option<&Connection>) -> Result<()> {
    let mut dirs = recovery_dirs(root)?;
    for (phase, dir) in &mut dirs {
        if *phase == Phase::Active {
            let stage = Stage::load(dir)?;
            if !stage.is_committed(connection)? {
                stage.restore(root)?;
            }
            *dir = phase_path(root, dir, Phase::Active, Phase::Purge)?;
            *phase = Phase::Purge;
        }
    }
    if !dirs.is_empty() {
        if let Some(conn) = connection {
            conn.execute(&format!("DROP TABLE IF EXISTS {COMMIT_TABLE}"), [])?;
        }
        for (_, dir) in dirs {
            fs::remove_dir_all(&dir)
                .map_err(|error| format!("Cleanup files remain at {}: {error}", dir.display()))?;
        }
    }
    Ok(())
}

fn phase_path(root: &Path, path: &Path, from: Phase, to: Phase) -> Result<PathBuf> {
    let suffix = path
        .file_name()
        .and_then(|name| name.to_str())
        .and_then(|name| name.strip_prefix(from.prefix()))
        .ok_or("Invalid cleanup directory name")?;
    let destination = root.join(format!("{}{suffix}", to.prefix()));
    if fs::symlink_metadata(&destination).is_ok() {
        return Err(format!(
            "Cleanup directory already exists: {}",
            destination.display()
        )
        .into());
    }
    fs::rename(path, &destination)?;
    Ok(destination)
}

struct Stage {
    dir: PathBuf,
    plan: CleanupPlan,
}

struct Replacement {
    path: PathBuf,
    original: Vec<u8>,
    filtered: Vec<u8>,
}

#[derive(Deserialize, Serialize)]
struct CleanupPlan {
    has_index: bool,
    files: Vec<PlannedFile>,
}

#[derive(Deserialize, Serialize)]
struct PlannedFile {
    path: PathBuf,
    replace: bool,
}

impl PlannedFile {
    fn validate(&self) -> bool {
        if self.replace {
            return [DESKTOP_INDEX, CLI_INDEX, RECENTS, METADATA, HISTORY]
                .iter()
                .any(|name| self.path == Path::new(name));
        }
        let Some(id) = self.path.file_stem().and_then(|stem| stem.to_str()) else {
            return false;
        };
        if !valid_id(id) {
            return false;
        }
        self.path == Path::new("brain").join(id)
            || session_artifacts(id)
                .iter()
                .any(|name| self.path == Path::new(name))
    }
}

impl Stage {
    fn prepare(
        root: &Path,
        files: Vec<PathBuf>,
        replacements: &[Replacement],
        has_index: bool,
    ) -> Result<Self> {
        let temp = tempfile::Builder::new()
            .prefix(PREPARE_PREFIX)
            .rand_bytes(12)
            .tempdir_in(root)?;
        let mut plan = CleanupPlan {
            has_index,
            files: Vec::new(),
        };
        for path in files {
            plan.files.push(PlannedFile {
                path: path.strip_prefix(root)?.to_owned(),
                replace: false,
            });
        }
        for replacement in replacements {
            let next = temp.path().join(format!("next-{}", plan.files.len()));
            let mut file = File::create_new(next)?;
            file.write_all(&replacement.filtered)?;
            file.sync_all()?;
            plan.files.push(PlannedFile {
                path: replacement.path.strip_prefix(root)?.to_owned(),
                replace: true,
            });
        }
        let mut plan_file = File::create_new(temp.path().join(PLAN))?;
        serde_json::to_writer(&mut plan_file, &plan)?;
        plan_file.sync_all()?;
        drop(plan_file);

        // No live files move until the complete plan has been published
        let dir = phase_path(root, temp.path(), Phase::Prepare, Phase::Active)?;
        Ok(Self { dir, plan })
    }

    fn load(dir: &Path) -> Result<Self> {
        let file = checked_file(dir, PLAN)?
            .ok_or_else(|| format!("Cleanup recovery plan missing at {}", dir.display()))?;
        let plan: CleanupPlan = serde_json::from_reader(File::open(file)?)?;
        let mut paths = BTreeSet::new();
        if plan.files.is_empty()
            || !plan
                .files
                .iter()
                .all(|file| file.validate() && paths.insert(&file.path))
        {
            return Err(format!("Invalid cleanup recovery plan at {}", dir.display()).into());
        }
        Ok(Self {
            dir: dir.to_owned(),
            plan,
        })
    }

    fn apply(&self, root: &Path, replacements: &[Replacement]) -> Result<()> {
        let mut replacements = replacements.iter();
        for (i, file) in self.plan.files.iter().enumerate() {
            let path = checked_path(root, &file.path)?
                .ok_or_else(|| format!("Session file disappeared: {}", file.path.display()))?;
            let backup = self.dir.join(format!("saved-{i}"));
            fs::rename(&path, &backup)?;
            if file.replace {
                let replacement = replacements.next().ok_or("Missing index replacement")?;
                if fs::read(&backup)? != replacement.original {
                    return Err(format!(
                        "Session index changed during cleanup: {}",
                        path.display()
                    )
                    .into());
                }
                self.write_replacement(&path, &backup, &replacement.filtered)?;
            }
        }
        Ok(())
    }

    fn write_replacement(&self, path: &Path, original: &Path, bytes: &[u8]) -> Result<()> {
        let mut tmp = tempfile::NamedTempFile::new_in(&self.dir)?;
        tmp.as_file()
            .set_permissions(fs::metadata(original)?.permissions())?;
        tmp.write_all(bytes)?;
        tmp.as_file().sync_all()?;
        tmp.persist_noclobber(path)?;
        Ok(())
    }

    fn commit(&self, tx: Option<rusqlite::Transaction<'_>>) -> Result<()> {
        if let Some(tx) = tx {
            // Put the marker in the same transaction as the index changes
            tx.execute(
                &format!("CREATE TABLE IF NOT EXISTS {COMMIT_TABLE} (stage TEXT PRIMARY KEY)"),
                [],
            )?;
            tx.execute(
                &format!("INSERT INTO {COMMIT_TABLE} VALUES (?1)"),
                [self
                    .dir
                    .file_name()
                    .and_then(|name| name.to_str())
                    .ok_or("Invalid cleanup stage")?],
            )?;
            tx.commit()?;
        } else {
            File::create_new(self.dir.join("committed"))?.sync_all()?;
        }
        Ok(())
    }

    fn is_committed(&self, connection: Option<&Connection>) -> Result<bool> {
        if !self.plan.has_index {
            return Ok(checked_file(&self.dir, "committed")?.is_some());
        }
        let conn = connection.ok_or("Summary database missing during cleanup recovery")?;
        if !has_column(conn, COMMIT_TABLE, "stage")? {
            return Ok(false);
        }
        Ok(conn.query_row(
            &format!("SELECT EXISTS(SELECT 1 FROM {COMMIT_TABLE} WHERE stage = ?1)"),
            [self
                .dir
                .file_name()
                .and_then(|name| name.to_str())
                .ok_or("Invalid cleanup stage")?],
            |row| row.get(0),
        )?)
    }

    fn restore(&self, root: &Path) -> Result<()> {
        for (i, file) in self.plan.files.iter().enumerate().rev() {
            let Some(backup) = checked_path(&self.dir, Path::new(&format!("saved-{i}")))? else {
                continue;
            };
            if let Some(current) = checked_path(root, &file.path)? {
                let next = checked_file(&self.dir, &format!("next-{i}"))?;
                let can_replace = file.replace
                    && current.is_file()
                    && next.is_some_and(|next| {
                        fs::read(next)
                            .ok()
                            .zip(fs::read(&current).ok())
                            .is_some_and(|(expected, bytes)| expected == bytes)
                    });
                if !can_replace {
                    return Err(format!(
                        "Newer data exists at {}; recovery files are at {}",
                        current.display(),
                        self.dir.display()
                    )
                    .into());
                }
            }
            fs::rename(backup, root.join(&file.path))?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;

    const TARGET: &str = "00000000-0000-4000-8000-000000000001";
    const FORK: &str = "00000000-0000-4000-8000-000000000002";
    const NESTED: &str = "00000000-0000-4000-8000-000000000003";

    fn summary_entry(id: &str, timestamp: bool) -> Vec<u8> {
        let mut entry = vec![if timestamp { 18 } else { 10 }, 40, 10, 36];
        entry.extend_from_slice(id.as_bytes());
        entry.extend(if timestamp { [16, 1] } else { [18, 0] });
        entry
    }

    fn store() -> tempfile::TempDir {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path();
        let conn = Connection::open(root.join(INDEX_DB)).unwrap();
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             CREATE TABLE conversation_summaries (
                conversation_id TEXT PRIMARY KEY, parent_conversation_id TEXT, nesting_depth INTEGER
             );
             CREATE VIRTUAL TABLE conversations_fts USING fts5(conversation_id UNINDEXED, body);
             CREATE TABLE conversation_parents (conversation_id TEXT PRIMARY KEY, parent_id TEXT);",
        )
        .unwrap();
        for (id, parent, depth) in [(TARGET, "", 0), (FORK, TARGET, 0), (NESTED, TARGET, 1)] {
            conn.execute(
                "INSERT INTO conversation_summaries VALUES (?1, ?2, ?3)",
                rusqlite::params![id, parent, depth],
            )
            .unwrap();
            conn.execute("INSERT INTO conversations_fts VALUES (?1, 'example')", [id])
                .unwrap();
            conn.execute(
                "INSERT INTO conversation_parents VALUES (?1, ?2)",
                [id, parent],
            )
            .unwrap();
            for folder in ["brain", "annotations", "conversations", "cache", "presence"] {
                fs::create_dir_all(root.join(folder)).unwrap();
            }
            fs::create_dir(root.join("brain").join(id)).unwrap();
            fs::write(
                root.join("brain").join(id).join("transcript.jsonl"),
                b"example",
            )
            .unwrap();
            for suffix in [".db", ".db-wal", ".db-shm", ".db-journal"] {
                fs::write(
                    root.join("conversations").join(format!("{id}{suffix}")),
                    b"example",
                )
                .unwrap();
            }
            fs::write(
                root.join("annotations").join(format!("{id}.pbtxt")),
                b"example",
            )
            .unwrap();
            fs::write(root.join("presence").join(format!("{id}.lock")), b"").unwrap();
        }
        fs::write(
            root.join(METADATA),
            serde_json::json!({"conversations": {
                TARGET: {"summary": {"ID": TARGET, "Title": "Target"}, "is_internal": false},
                FORK: {"summary": {"ID": FORK, "Title": "Fork"}, "is_internal": false},
            }})
            .to_string(),
        )
        .unwrap();
        let proto: Vec<_> = [TARGET, FORK, NESTED]
            .into_iter()
            .flat_map(|id| [summary_entry(id, false), summary_entry(id, true)].concat())
            .collect();
        fs::write(root.join(DESKTOP_INDEX), proto).unwrap();
        fs::write(
            root.join("cache/last_conversations.json"),
            format!(r#"{{"/example":"{TARGET}","/fork":"{FORK}"}}"#),
        )
        .unwrap();
        fs::write(root.join("user_settings.pb"), b"untouched").unwrap();
        fs::write(root.join(HISTORY), history(&[TARGET, FORK])).unwrap();
        temp
    }

    fn history(ids: &[&str]) -> String {
        let mut lines = String::from("{\"type\":\"command\",\"display\":\"/help\"}\n");
        for id in ids {
            lines += &format!("{{\"conversationId\":\"{id}\",\"display\":\"prompt\"}}\n");
        }
        lines
    }

    fn assert_rows(root: &Path, expected: &[&str]) {
        let conn = Connection::open(root.join(INDEX_DB)).unwrap();
        for table in [
            "conversation_summaries",
            "conversations_fts",
            "conversation_parents",
        ] {
            let mut statement = conn
                .prepare(&format!(
                    "SELECT conversation_id FROM {table} ORDER BY conversation_id"
                ))
                .unwrap();
            let rows: Vec<String> = statement
                .query_map([], |row| row.get(0))
                .unwrap()
                .collect::<rusqlite::Result<_>>()
                .unwrap();
            assert_eq!(rows, expected, "{table}");
        }
    }

    #[test]
    fn cleanup_clears_an_index_only_session_and_preserves_its_fork() {
        let temp = store();
        let root = temp.path();
        fs::remove_dir_all(root.join("brain").join(TARGET)).unwrap();
        for suffix in [".db", ".db-wal", ".db-shm", ".db-journal"] {
            fs::remove_file(root.join("conversations").join(format!("{TARGET}{suffix}"))).unwrap();
        }
        clean(root, DESKTOP_INDEX, &[TARGET], || Ok(())).unwrap();
        assert_rows(root, &[FORK]);
        assert!(!root.join("brain").join(NESTED).exists());
        assert!(!root
            .join("annotations")
            .join(format!("{TARGET}.pbtxt"))
            .exists());
        assert!(!root
            .join("conversations")
            .join(format!("{NESTED}.db-wal"))
            .exists());
        assert!(root.join("brain").join(FORK).is_dir());
        assert_eq!(
            fs::read(root.join(DESKTOP_INDEX)).unwrap(),
            [summary_entry(FORK, false), summary_entry(FORK, true)].concat(),
        );
        assert_eq!(
            serde_json::from_slice::<serde_json::Value>(
                &fs::read(root.join("cache/last_conversations.json")).unwrap(),
            )
            .unwrap(),
            serde_json::json!({"/fork": FORK}),
        );
        assert_eq!(
            serde_json::from_slice::<serde_json::Value>(&fs::read(root.join(METADATA)).unwrap())
                .unwrap(),
            serde_json::json!({"conversations": {
                FORK: {"summary": {"ID": FORK, "Title": "Fork"}, "is_internal": false},
            }}),
        );
        assert_eq!(
            fs::read_to_string(root.join(HISTORY)).unwrap(),
            history(&[FORK])
        );
        for (id, kept) in [(TARGET, false), (NESTED, false), (FORK, true)] {
            let lock = root.join("presence").join(format!("{id}.lock"));
            assert_eq!(lock.exists(), kept, "{id}");
        }
        assert_eq!(
            fs::read(root.join("user_settings.pb")).unwrap(),
            b"untouched"
        );
        let index = fs::read(root.join(INDEX_DB)).unwrap();
        assert!(!index
            .windows(NESTED.len())
            .any(|bytes| bytes == NESTED.as_bytes()));
        assert!(root.join(LOCK).is_file());
        clean(root, DESKTOP_INDEX, &[TARGET], || Ok(())).unwrap();
    }

    #[test]
    fn client_restart_restores_files_and_rolls_back_indexes() {
        let temp = store();
        let root = temp.path();
        let proto = fs::read(root.join(DESKTOP_INDEX)).unwrap();
        let checks = Cell::new(0);
        let error = clean(root, DESKTOP_INDEX, &[TARGET], || {
            checks.set(checks.get() + 1);
            if checks.get() == 3 {
                Err("client restarted".into())
            } else {
                Ok(())
            }
        })
        .unwrap_err();
        assert_eq!(error.to_string(), "client restarted");
        assert_rows(root, &[TARGET, FORK, NESTED]);
        assert!(root.join("brain").join(TARGET).is_dir());
        assert!(root
            .join("conversations")
            .join(format!("{NESTED}.db-journal"))
            .is_file());
        assert_eq!(fs::read(root.join(DESKTOP_INDEX)).unwrap(), proto);
        assert!(root
            .join("presence")
            .join(format!("{TARGET}.lock"))
            .is_file());
        assert!(fs::read_to_string(root.join(METADATA))
            .unwrap()
            .contains(TARGET));
        assert_eq!(
            fs::read_to_string(root.join(HISTORY)).unwrap(),
            history(&[TARGET, FORK])
        );
    }

    #[test]
    fn unknown_cache_formats_block_cleanup_only_when_they_name_the_session() {
        let ids = BTreeSet::from([TARGET.to_owned()]);
        for bytes in [&b""[..], b"null", br#"{"conversations":null}"#] {
            assert!(filtered_recents(bytes, &ids).unwrap().is_none());
            assert!(filtered_metadata(bytes, &ids).unwrap().is_none());
        }
        let unknown = format!(r#"["{TARGET}"]"#);
        assert!(filtered_recents(unknown.as_bytes(), &ids).is_err());
        assert!(filtered_metadata(unknown.as_bytes(), &ids).is_err());
    }

    #[test]
    fn unknown_index_format_leaves_the_conversation_intact() {
        let temp = store();
        let root = temp.path();
        fs::write(root.join(DESKTOP_INDEX), [10, 255]).unwrap();
        assert!(clean(root, DESKTOP_INDEX, &[TARGET], || Ok(())).is_err());
        assert_rows(root, &[TARGET, FORK, NESTED]);
        assert!(root.join("brain").join(TARGET).is_dir());
    }

    #[test]
    fn removes_deleted_search_terms_from_disk() {
        let temp = store();
        let root = temp.path();
        let conn = Connection::open(root.join(INDEX_DB)).unwrap();
        conn.execute(
            "UPDATE conversations_fts SET body = 'deletedsearchfixture' WHERE conversation_id = ?1",
            [TARGET],
        )
        .unwrap();
        conn.execute(
            "UPDATE conversations_fts SET body = 'keptsearchfixture' WHERE conversation_id = ?1",
            [FORK],
        )
        .unwrap();
        drop(conn);
        let contains = |term: &str| {
            fs::read(root.join(INDEX_DB))
                .unwrap()
                .windows(term.len())
                .any(|bytes| bytes == term.as_bytes())
        };
        assert!(contains("deletedsearchfixture"));
        clean(root, DESKTOP_INDEX, &[TARGET], || Ok(())).unwrap();
        assert!(!contains("deletedsearchfixture"));
        assert!(contains("keptsearchfixture"));
        assert_rows(root, &[FORK]);
    }

    #[test]
    fn interruption_fixture_child() {
        let Some(root) = std::env::var_os("ANTI_POWER_INTERRUPTION_FIXTURE") else {
            return;
        };
        let root = PathBuf::from(root);
        assert!(root.join("interruption-fixture").is_file());
        let mut conn = open_index(&root).unwrap();
        let tx = conn.as_mut().map(|conn| {
            conn.transaction_with_behavior(TransactionBehavior::Immediate)
                .unwrap()
        });
        let ids = related_ids(tx.as_deref(), &[TARGET]).unwrap();
        let files = session_files(&root, &ids).unwrap();
        let index = root.join(DESKTOP_INDEX);
        let original = fs::read(&index).unwrap();
        let filtered = filtered_index(&original, &ids, true).unwrap().unwrap();
        let replacements = [Replacement {
            path: index,
            original,
            filtered,
        }];
        let stage = Stage::prepare(&root, files, &replacements, tx.is_some()).unwrap();
        if let Some(tx) = &tx {
            remove_index_rows(tx, &ids).unwrap();
        }
        stage.apply(&root, &replacements).unwrap();
        if std::env::var_os("ANTI_POWER_INTERRUPTION_COMMIT").is_some() {
            stage.commit(tx).unwrap();
        }
        std::process::exit(17);
    }

    #[test]
    fn recovers_before_and_after_commit_even_when_the_process_exits() {
        for with_index in [false, true] {
            for committed in [false, true] {
                let temp = store();
                let canonical_root = temp.path().canonicalize().unwrap();
                let root = canonical_root.as_path();
                fs::write(root.join("interruption-fixture"), b"").unwrap();
                if !with_index {
                    fs::remove_file(root.join(INDEX_DB)).unwrap();
                }
                let original_index = fs::read(root.join(DESKTOP_INDEX)).unwrap();
                let mut child = std::process::Command::new(std::env::current_exe().unwrap());
                child
                    .args([
                        "--exact",
                        "commands::antigravity_clean::tests::interruption_fixture_child",
                    ])
                    .env("ANTI_POWER_INTERRUPTION_FIXTURE", root)
                    .env_remove("ANTI_POWER_INTERRUPTION_COMMIT");
                if committed {
                    child.env("ANTI_POWER_INTERRUPTION_COMMIT", "1");
                }
                let output = child.output().unwrap();
                assert_eq!(output.status.code(), Some(17), "{output:?}");
                assert!(!recovery_dirs(root).unwrap().is_empty());
                assert!(!root.join("brain").join(TARGET).is_dir());

                let conn = open_index(root).unwrap();
                recover_locked(root, conn.as_ref()).unwrap();
                assert!(recovery_dirs(root).unwrap().is_empty());
                assert_eq!(root.join("brain").join(TARGET).is_dir(), !committed);
                assert_eq!(
                    fs::read(root.join(DESKTOP_INDEX)).unwrap() == original_index,
                    !committed
                );
                assert!(root.join("brain").join(FORK).is_dir());
                if let Some(conn) = &conn {
                    assert!(!has_column(conn, COMMIT_TABLE, "stage").unwrap());
                    if committed {
                        assert_rows(root, &[FORK]);
                    } else {
                        assert_rows(root, &[TARGET, FORK, NESTED]);
                    }
                }
            }
        }
    }

    #[test]
    fn recovery_preserves_files_written_after_the_interruption() {
        let temp = store();
        let root = temp.path();
        let index = root.join(DESKTOP_INDEX);
        let original = fs::read(&index).unwrap();
        let replacements = [Replacement {
            path: index.clone(),
            original: original.clone(),
            filtered: b"staged replacement".to_vec(),
        }];
        let stage = Stage::prepare(root, Vec::new(), &replacements, false).unwrap();
        stage.apply(root, &replacements).unwrap();
        fs::write(&index, b"newer data").unwrap();

        let error = recover_locked(root, None).unwrap_err();
        assert!(error.to_string().contains("Newer data exists"));
        assert_eq!(fs::read(&index).unwrap(), b"newer data");
        assert_eq!(fs::read(stage.dir.join("saved-0")).unwrap(), original);
    }

    #[test]
    fn cleanup_preserves_an_index_updated_after_it_was_read() {
        let temp = store();
        let root = temp.path();
        let path = root.join(DESKTOP_INDEX);
        let mut updated = fs::read(&path).unwrap();
        updated.extend(summary_entry("00000000-0000-4000-8000-000000000004", false));
        let checks = Cell::new(0);
        let error = clean(root, DESKTOP_INDEX, &[TARGET], || {
            checks.set(checks.get() + 1);
            if checks.get() == 2 {
                fs::write(&path, &updated)?;
            }
            Ok(())
        })
        .unwrap_err();

        assert!(error.to_string().contains("Session index changed"));
        assert_eq!(fs::read(path).unwrap(), updated);
        assert_rows(root, &[TARGET, FORK, NESTED]);
        assert!(root.join("brain").join(TARGET).is_dir());
        assert!(recovery_dirs(root).unwrap().is_empty());
    }

    #[test]
    fn rescan_keeps_same_id_in_the_other_store_until_selected() {
        use super::super::antigravity_scan::scan;
        use super::super::antigravity_store::CLI;

        let home = tempfile::tempdir().unwrap();
        let gemini = home.path().join(".gemini");
        fs::create_dir(&gemini).unwrap();
        let desktop = gemini.join("antigravity");
        let cli = gemini.join("antigravity-cli");
        fs::rename(store().keep(), &desktop).unwrap();
        fs::rename(store().keep(), &cli).unwrap();
        let cli_proto: Vec<_> = [TARGET, FORK, NESTED]
            .into_iter()
            .flat_map(|id| summary_entry(id, false))
            .collect();
        fs::write(cli.join(CLI_INDEX), cli_proto).unwrap();
        fs::remove_file(cli.join(DESKTOP_INDEX)).unwrap();
        let target_present = |provider| {
            scan(home.path(), provider)
                .unwrap()
                .iter()
                .any(|session| session.session_id == TARGET)
        };
        assert!(target_present(CLI) && target_present(DESKTOP));
        clean(&cli, CLI_INDEX, &[TARGET], || Ok(())).unwrap();
        assert!(!target_present(CLI) && target_present(DESKTOP));
        clean(&desktop, DESKTOP_INDEX, &[TARGET], || Ok(())).unwrap();
        assert!(!target_present(CLI) && !target_present(DESKTOP));
    }

    #[test]
    fn cleans_several_sessions_in_one_pass() {
        let temp = store();
        let root = temp.path();
        clean(root, DESKTOP_INDEX, &[TARGET, FORK], || Ok(())).unwrap();
        assert_rows(root, &[]);
        assert!(fs::read(root.join(DESKTOP_INDEX)).unwrap().is_empty());
        assert_eq!(
            fs::read_to_string(root.join(HISTORY)).unwrap(),
            history(&[])
        );
        assert!(recovery_dirs(root).unwrap().is_empty());
        for id in [TARGET, FORK, NESTED] {
            assert!(!root.join("brain").join(id).exists());
        }
    }

    #[test]
    fn a_blocked_session_does_not_hold_back_the_rest_of_its_batch() {
        let home = tempfile::tempdir().unwrap();
        let home = home.path();
        fs::create_dir(home.join(".gemini")).unwrap();
        let root = home.join(".gemini/antigravity");
        fs::rename(store().keep(), &root).unwrap();
        fs::remove_dir_all(root.join("brain").join(FORK)).unwrap();
        fs::write(root.join("brain").join(FORK), b"unexpected").unwrap();
        let session = |id: &str| SessionRef {
            provider_id: DESKTOP.to_owned(),
            source_path: root.join("conversations").join(format!("{id}.db")),
            session_id: id.to_owned(),
        };

        let sessions = [session(TARGET), session(FORK), session("invalid")];
        let results = delete_with(home, &sessions, || Ok(()));
        assert_eq!(results[0], None);
        assert!(results[1].as_deref().unwrap().contains("session directory"));
        assert!(results[2].is_some());
        assert_rows(&root, &[FORK]);

        let results = delete_with(home, &sessions[1..2], || Err("client running".into()));
        assert_eq!(results, [Some("client running".to_owned())]);
    }

    #[test]
    fn a_store_wide_failure_is_not_retried_for_each_session() {
        let home = tempfile::tempdir().unwrap();
        let home = home.path();
        fs::create_dir(home.join(".gemini")).unwrap();
        let root = home.join(".gemini/antigravity");
        fs::rename(store().keep(), &root).unwrap();
        fs::write(root.join(DESKTOP_INDEX), [10, 255]).unwrap();
        let sessions = [TARGET, FORK].map(|id| SessionRef {
            provider_id: DESKTOP.to_owned(),
            source_path: root.join("conversations").join(format!("{id}.db")),
            session_id: id.to_owned(),
        });

        let checks = Cell::new(0);
        let results = delete_with(home, &sessions, || {
            checks.set(checks.get() + 1);
            Ok(())
        });
        for error in results {
            assert!(error.unwrap().contains("summary index format"));
        }
        // One check for the batch and one for the only pass over the store
        assert_eq!(checks.get(), 2);
        assert_rows(&root, &[TARGET, FORK, NESTED]);
    }

    #[test]
    fn names_the_client_that_blocks_cleanup() {
        let app = "/Applications/Antigravity.app/Contents";
        let ide = "/Applications/Antigravity IDE.app/Contents";
        let cli = "/opt/homebrew/Caskroom/antigravity-cli/1.5.12/antigravity";
        for (name, path, expected) in [
            (
                "Antigravity",
                format!("{app}/MacOS/Antigravity"),
                Some(Client::AppOrCli),
            ),
            ("antigravity", cli.to_owned(), Some(Client::AppOrCli)),
            ("agy.exe", String::new(), Some(Client::AppOrCli)),
            (
                "language_server",
                format!("{app}/Resources/bin/language_server"),
                Some(Client::AppOrCli),
            ),
            (
                "language_server",
                format!("{ide}/Resources/bin/language_server"),
                Some(Client::Ide),
            ),
            (
                "Antigravity IDE",
                format!("{ide}/MacOS/Antigravity IDE"),
                Some(Client::Ide),
            ),
            (
                "Antigravity",
                format!("{ide}/MacOS/Antigravity"),
                Some(Client::Ide),
            ),
            (
                "language_server",
                "/usr/local/bin/language_server".to_owned(),
                None,
            ),
            ("Code Helper", String::new(), None),
        ] {
            assert_eq!(client(name, &path), expected, "{name} at {path}");
        }
    }

    #[test]
    fn lists_and_cleans_a_record_that_only_the_summary_index_holds() {
        use super::super::antigravity_scan::scan;
        use super::super::antigravity_store::CLI;

        let home = tempfile::tempdir().unwrap();
        for (provider, relative, index, timestamp) in [
            (CLI, ".gemini/antigravity-cli", CLI_INDEX, false),
            (DESKTOP, ".gemini/antigravity", DESKTOP_INDEX, true),
        ] {
            let root = home.path().join(relative);
            fs::create_dir_all(&root).unwrap();
            fs::write(root.join(index), summary_entry(TARGET, timestamp)).unwrap();
            let rows = scan(home.path(), provider).unwrap();
            assert_eq!(rows.len(), 1);
            assert!(rows[0].session_id == TARGET && rows[0].index_only);

            clean(&root, index, &[TARGET], || Ok(())).unwrap();
            assert!(scan(home.path(), provider).unwrap().is_empty());
            fs::write(root.join(index), [10, 255]).unwrap();
            assert!(scan(home.path(), provider).unwrap().is_empty());
        }
    }
}
