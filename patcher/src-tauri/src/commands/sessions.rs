//! Session history
//!
//! Browse local sessions from Claude Code, Codex, Gemini CLI, OpenCode, and OpenClaw

use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};

/// Session metadata
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionMeta {
    pub provider_id: String,
    pub session_id: String,
    pub title: Option<String>,
    pub summary: Option<String>,
    pub project_dir: Option<String>,
    pub created_at: Option<u64>,
    pub last_active_at: Option<u64>,
    pub source_path: String,
}

/// A single session message
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionMessage {
    pub role: String,
    pub content: String,
    pub ts: Option<u64>,
}

// Tauri commands

/// List a provider's session metadata without loading message bodies
#[tauri::command]
pub fn scan_sessions(providers: Vec<String>) -> Result<Vec<SessionMeta>, String> {
    let home = dirs::home_dir().ok_or("无法确定用户目录")?;
    let mut sessions = Vec::new();

    for provider in &providers {
        let result = match provider.as_str() {
            "claude" => scan_claude(&home),
            "codex" => scan_codex(&home),
            "gemini" => scan_gemini(&home),
            "opencode" => scan_opencode(&home),
            "openclaw" => scan_openclaw(&home),
            _ => continue,
        };
        if let Ok(mut s) = result {
            sessions.append(&mut s);
        }
    }

    sessions.sort_by(|a, b| b.last_active_at.cmp(&a.last_active_at));
    Ok(sessions)
}

/// Load a session's messages on demand
#[tauri::command]
pub fn load_session_messages(
    provider_id: String,
    source_path: String,
) -> Result<Vec<SessionMessage>, String> {
    let path = Path::new(&source_path);
    if !path.exists() {
        return Err(format!("文件不存在: {}", source_path));
    }

    match provider_id.as_str() {
        "claude" => parse_claude_messages(path),
        "codex" => parse_codex_messages(path),
        "gemini" => parse_gemini_messages(path),
        "opencode" => parse_opencode_messages(path),
        "openclaw" => parse_openclaw_messages(path),
        _ => Err(format!("未知的 provider: {}", provider_id)),
    }
}

/// Delete one session
#[tauri::command]
pub fn delete_session(
    provider_id: String,
    source_path: String,
    session_id: String,
) -> Result<(), String> {
    match provider_id.as_str() {
        "claude" | "codex" | "gemini" | "openclaw" => delete_single_file(&source_path),
        "opencode" => delete_opencode_session(&source_path, &session_id),
        _ => Err(format!("未知的 provider: {}", provider_id)),
    }
}

/// Delete the session file for Claude Code, Codex, Gemini CLI, or OpenClaw
fn delete_single_file(source_path: &str) -> Result<(), String> {
    let path = Path::new(source_path);
    if !path.exists() {
        return Err(format!("文件不存在: {}", source_path));
    }
    fs::remove_file(path).map_err(|e| format!("删除失败: {}", e))
}

/// Delete the OpenCode session file and its message and part directories
/// Full cleanup handles orphaned rows in `opencode.db`
fn delete_opencode_session(source_path: &str, session_id: &str) -> Result<(), String> {
    let msg_dir = Path::new(source_path);
    let storage = msg_dir
        .parent()
        .and_then(|p| p.parent())
        .ok_or("无法确定 storage 目录")?;

    // Collect message IDs before removing their part directories
    let mut message_ids = Vec::new();
    if msg_dir.is_dir() {
        let msg_files = collect_files_recursive(msg_dir, "json");
        for msg_file in msg_files {
            if let Ok(content) = fs::read_to_string(&msg_file) {
                if let Ok(obj) = serde_json::from_str::<Value>(&content) {
                    if let Some(id) = obj.get("id").and_then(|v| v.as_str()) {
                        message_ids.push(id.to_string());
                    }
                }
            }
        }
    }

    let parts_root = storage.join("part");
    for mid in &message_ids {
        let part_dir = parts_root.join(mid);
        if part_dir.is_dir() {
            let _ = fs::remove_dir_all(&part_dir);
        }
    }

    if msg_dir.is_dir() {
        fs::remove_dir_all(msg_dir).map_err(|e| format!("删除 message 目录失败: {}", e))?;
    }

    let session_file = storage.join("session").join(format!("{}.json", session_id));
    if session_file.exists() {
        fs::remove_file(&session_file).map_err(|e| format!("删除 session 文件失败: {}", e))?;
    }

    Ok(())
}


/// Extract text from a JSON value
/// Accept strings, single objects, or arrays of objects with `text`, `input_text`, or `output_text`
fn extract_text(value: &Value) -> String {
    match value {
        Value::String(s) => s.clone(),
        Value::Array(arr) => {
            let mut parts = Vec::new();
            for item in arr {
                if let Some(s) = item.get("text").and_then(|v| v.as_str()) {
                    parts.push(s.to_string());
                } else if let Some(s) = item.get("input_text").and_then(|v| v.as_str()) {
                    parts.push(s.to_string());
                } else if let Some(s) = item.get("output_text").and_then(|v| v.as_str()) {
                    parts.push(s.to_string());
                } else if let Some(s) = item.get("content").and_then(|v| v.as_str()) {
                    parts.push(s.to_string());
                }
            }
            parts.join("\n")
        }
        Value::Object(obj) => obj
            .get("text")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        _ => String::new(),
    }
}

/// Truncate a summary to the specified character count
fn truncate(text: &str, max_chars: usize) -> String {
    if text.chars().count() <= max_chars {
        text.to_string()
    } else {
        let truncated: String = text.chars().take(max_chars).collect();
        format!("{}...", truncated)
    }
}

/// Parse a time field as a Unix timestamp in milliseconds
fn parse_timestamp(value: &Value) -> Option<u64> {
    value
        .as_str()
        .and_then(|s| {
            // Numeric strings may use seconds or milliseconds
            if let Ok(ts) = s.parse::<u64>() {
                return Some(if ts > 1_000_000_000_000 {
                    ts
                } else {
                    ts * 1000
                });
            }

            parse_iso8601_to_ms(s)
        })
        .or_else(|| {
            value.as_f64().map(|f| {
                let ts = f as u64;
                if ts > 1_000_000_000_000 {
                    ts
                } else {
                    ts * 1000
                }
            })
        })
}

/// Parse the supported ISO 8601 formats without a chrono dependency
fn parse_iso8601_to_ms(s: &str) -> Option<u64> {
    // Examples: 2024-01-15T10:30:00.000Z or 2024-01-15T10:30:00+08:00
    let s = s.trim();
    if s.len() < 19 {
        return None;
    }

    let year: i64 = s.get(0..4)?.parse().ok()?;
    let month: i64 = s.get(5..7)?.parse().ok()?;
    let day: i64 = s.get(8..10)?.parse().ok()?;
    let hour: i64 = s.get(11..13)?.parse().ok()?;
    let minute: i64 = s.get(14..16)?.parse().ok()?;
    let second: i64 = s.get(17..19)?.parse().ok()?;

    // Sorting and display need no leap-second correction
    let days_since_epoch = days_from_civil(year, month, day)?;
    let secs = days_since_epoch * 86400 + hour * 3600 + minute * 60 + second;

    let mut millis: i64 = 0;
    let rest = &s[19..];
    if let Some(frac) = rest.strip_prefix('.') {
        let frac_digits: String = frac.chars().take_while(|c| c.is_ascii_digit()).collect();
        if !frac_digits.is_empty() {
            let padded = format!("{:0<3}", &frac_digits[..frac_digits.len().min(3)]);
            millis = padded.parse().unwrap_or(0);
        }
    }

    Some((secs * 1000 + millis) as u64)
}

/// Convert a civil date to days since 1970-01-01
fn days_from_civil(year: i64, month: i64, day: i64) -> Option<i64> {
    let y = if month <= 2 { year - 1 } else { year };
    let m = if month <= 2 { month + 9 } else { month - 3 };
    let era = y.div_euclid(400);
    let yoe = y.rem_euclid(400);
    let doy = (153 * m + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    Some(era * 146097 + doe - 719468)
}

/// Read the file modification time in milliseconds since the Unix epoch
fn file_modified_ms(path: &Path) -> Option<u64> {
    fs::metadata(path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
}

/// Return the final path component
fn path_basename(path: &str) -> Option<String> {
    Path::new(path)
        .file_name()
        .and_then(|n| n.to_str())
        .map(|s| s.to_string())
}

/// Recursively collect files with the given extension
fn collect_files_recursive(dir: &Path, extension: &str) -> Vec<PathBuf> {
    let mut result = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                result.extend(collect_files_recursive(&path, extension));
            } else if path.extension().and_then(|e| e.to_str()) == Some(extension) {
                result.push(path);
            }
        }
    }
    result
}

/// Read the first N lines of a JSONL file
fn read_head_lines(path: &Path, n: usize) -> Vec<String> {
    let file = match fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return Vec::new(),
    };
    BufReader::new(file)
        .lines()
        .take(n)
        .filter_map(|l| l.ok())
        .collect()
}

/// Read the last N lines of a JSONL file, seeking near the end for large files
fn read_tail_lines(path: &Path, n: usize) -> Vec<String> {
    let file = match fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return Vec::new(),
    };
    let metadata = match file.metadata() {
        Ok(m) => m,
        Err(_) => return Vec::new(),
    };

    let file_size = metadata.len();
    if file_size < 16 * 1024 {
        let all_lines: Vec<String> = BufReader::new(file)
            .lines()
            .filter_map(|l| l.ok())
            .collect();
        let start = all_lines.len().saturating_sub(n);
        return all_lines[start..].to_vec();
    }

    use std::io::{Read, Seek, SeekFrom};
    let mut file = file;
    let seek_pos = file_size.saturating_sub(32 * 1024);
    if file.seek(SeekFrom::Start(seek_pos)).is_err() {
        return Vec::new();
    }
    let mut buf = String::new();
    if file.read_to_string(&mut buf).is_err() {
        return Vec::new();
    }
    let lines: Vec<String> = buf.lines().map(|s| s.to_string()).collect();
    let start = lines.len().saturating_sub(n);
    lines[start..].to_vec()
}

// Claude Code

fn scan_claude(home: &Path) -> Result<Vec<SessionMeta>, String> {
    let projects_dir = home.join(".claude").join("projects");
    if !projects_dir.is_dir() {
        return Ok(Vec::new());
    }

    let files = collect_files_recursive(&projects_dir, "jsonl");
    let mut sessions = Vec::new();

    for file_path in files {
        // Files prefixed with agent- are subagent sessions
        if let Some(name) = file_path.file_stem().and_then(|n| n.to_str()) {
            if name.starts_with("agent-") {
                continue;
            }
        }

        let head = read_head_lines(&file_path, 10);
        let tail = read_tail_lines(&file_path, 30);

        let mut session_id = None;
        let mut cwd = None;
        let mut created_at = None;

        for line in &head {
            if let Ok(obj) = serde_json::from_str::<Value>(line) {
                if session_id.is_none() {
                    session_id = obj
                        .get("sessionId")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                }
                if cwd.is_none() {
                    cwd = obj
                        .get("cwd")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                }
                if created_at.is_none() {
                    created_at = parse_timestamp(obj.get("timestamp").unwrap_or(&Value::Null));
                }
            }
        }

        let mut last_active_at = None;
        let mut summary = None;
        for line in tail.iter().rev() {
            if let Ok(obj) = serde_json::from_str::<Value>(line) {
                if obj.get("isMeta").and_then(|v| v.as_bool()).unwrap_or(false) {
                    continue;
                }
                if last_active_at.is_none() {
                    last_active_at = parse_timestamp(obj.get("timestamp").unwrap_or(&Value::Null));
                }
                if summary.is_none() {
                    if let Some(msg) = obj.get("message") {
                        let text = extract_text(msg.get("content").unwrap_or(&Value::Null));
                        if !text.is_empty() {
                            summary = Some(truncate(&text, 160));
                        }
                    }
                }
                if last_active_at.is_some() && summary.is_some() {
                    break;
                }
            }
        }

        // Fall back to the modification time when activity time is missing
        if last_active_at.is_none() {
            last_active_at = file_modified_ms(&file_path);
        }

        let sid = session_id.unwrap_or_else(|| {
            file_path
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string()
        });
        let title = cwd.as_deref().and_then(path_basename);

        sessions.push(SessionMeta {
            provider_id: "claude".to_string(),
            session_id: sid,
            title,
            summary,
            project_dir: cwd,
            created_at,
            last_active_at,
            source_path: file_path.to_string_lossy().to_string(),
        });
    }

    Ok(sessions)
}

fn parse_claude_messages(path: &Path) -> Result<Vec<SessionMessage>, String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);
    let mut messages = Vec::new();

    for line in reader.lines() {
        let line = line.map_err(|e| e.to_string())?;
        if let Ok(obj) = serde_json::from_str::<Value>(&line) {
            if obj.get("isMeta").and_then(|v| v.as_bool()).unwrap_or(false) {
                continue;
            }
            if let Some(msg) = obj.get("message") {
                let role = msg
                    .get("role")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown")
                    .to_string();
                let content = extract_text(msg.get("content").unwrap_or(&Value::Null));
                if content.is_empty() {
                    continue;
                }
                let ts = parse_timestamp(obj.get("timestamp").unwrap_or(&Value::Null));
                messages.push(SessionMessage { role, content, ts });
            }
        }
    }

    Ok(messages)
}

// Codex

fn scan_codex(home: &Path) -> Result<Vec<SessionMeta>, String> {
    let sessions_dir = home.join(".codex").join("sessions");
    if !sessions_dir.is_dir() {
        return Ok(Vec::new());
    }

    let files = collect_files_recursive(&sessions_dir, "jsonl");
    let mut sessions = Vec::new();

    for file_path in files {
        let head = read_head_lines(&file_path, 10);
        let tail = read_tail_lines(&file_path, 30);

        let mut session_id = None;
        let mut cwd = None;
        let mut created_at = None;

        for line in &head {
            if let Ok(obj) = serde_json::from_str::<Value>(line) {
                if obj.get("type").and_then(|v| v.as_str()) == Some("session_meta") {
                    if let Some(payload) = obj.get("payload") {
                        session_id = payload
                            .get("id")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                        cwd = payload
                            .get("cwd")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                        created_at = parse_timestamp(
                            payload
                                .get("timestamp")
                                .or_else(|| obj.get("timestamp"))
                                .unwrap_or(&Value::Null),
                        );
                    }
                    break;
                }
            }
        }

        let mut last_active_at = None;
        let mut summary = None;
        for line in tail.iter().rev() {
            if let Ok(obj) = serde_json::from_str::<Value>(line) {
                if last_active_at.is_none() {
                    last_active_at = parse_timestamp(obj.get("timestamp").unwrap_or(&Value::Null));
                }
                if summary.is_none() {
                    if obj.get("type").and_then(|v| v.as_str()) == Some("response_item") {
                        if let Some(payload) = obj.get("payload") {
                            if payload.get("type").and_then(|v| v.as_str()) == Some("message") {
                                let text =
                                    extract_text(payload.get("content").unwrap_or(&Value::Null));
                                if !text.is_empty() {
                                    summary = Some(truncate(&text, 160));
                                }
                            }
                        }
                    }
                }
                if last_active_at.is_some() && summary.is_some() {
                    break;
                }
            }
        }

        if last_active_at.is_none() {
            last_active_at = file_modified_ms(&file_path);
        }

        // Older logs may carry the session UUID only in the filename
        if session_id.is_none() {
            session_id = file_path
                .file_stem()
                .and_then(|n| n.to_str())
                .map(|s| s.to_string());
        }

        let sid = session_id.unwrap_or_default();
        let title = cwd.as_deref().and_then(path_basename);

        sessions.push(SessionMeta {
            provider_id: "codex".to_string(),
            session_id: sid,
            title,
            summary,
            project_dir: cwd,
            created_at,
            last_active_at,
            source_path: file_path.to_string_lossy().to_string(),
        });
    }

    Ok(sessions)
}

fn parse_codex_messages(path: &Path) -> Result<Vec<SessionMessage>, String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);
    let mut messages = Vec::new();

    for line in reader.lines() {
        let line = line.map_err(|e| e.to_string())?;
        if let Ok(obj) = serde_json::from_str::<Value>(&line) {
            if obj.get("type").and_then(|v| v.as_str()) != Some("response_item") {
                continue;
            }
            if let Some(payload) = obj.get("payload") {
                if payload.get("type").and_then(|v| v.as_str()) != Some("message") {
                    continue;
                }
                let role = payload
                    .get("role")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown")
                    .to_string();
                let content = extract_text(payload.get("content").unwrap_or(&Value::Null));
                if content.is_empty() {
                    continue;
                }
                let ts = parse_timestamp(obj.get("timestamp").unwrap_or(&Value::Null));
                messages.push(SessionMessage { role, content, ts });
            }
        }
    }

    Ok(messages)
}

// Gemini CLI

fn scan_gemini(home: &Path) -> Result<Vec<SessionMeta>, String> {
    let tmp_dir = home.join(".gemini").join("tmp");
    if !tmp_dir.is_dir() {
        return Ok(Vec::new());
    }

    let mut sessions = Vec::new();

    if let Ok(hash_dirs) = fs::read_dir(&tmp_dir) {
        for hash_entry in hash_dirs.flatten() {
            let chats_dir = hash_entry.path().join("chats");
            if !chats_dir.is_dir() {
                continue;
            }
            if let Ok(chat_files) = fs::read_dir(&chats_dir) {
                for chat_entry in chat_files.flatten() {
                    let file_path = chat_entry.path();
                    if file_path.extension().and_then(|e| e.to_str()) != Some("json") {
                        continue;
                    }

                    let content = match fs::read_to_string(&file_path) {
                        Ok(c) => c,
                        Err(_) => continue,
                    };
                    let obj: Value = match serde_json::from_str(&content) {
                        Ok(v) => v,
                        Err(_) => continue,
                    };

                    let session_id = obj
                        .get("sessionId")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    let created_at = parse_timestamp(obj.get("startTime").unwrap_or(&Value::Null));
                    let last_active_at =
                        parse_timestamp(obj.get("lastUpdated").unwrap_or(&Value::Null))
                            .or_else(|| file_modified_ms(&file_path));

                    // Use the first user message for the title and summary
                    let mut title = None;
                    let mut summary = None;
                    if let Some(msgs) = obj.get("messages").and_then(|v| v.as_array()) {
                        for msg in msgs {
                            if msg.get("type").and_then(|v| v.as_str()) == Some("user") {
                                let text = msg
                                    .get("content")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("")
                                    .to_string();
                                if !text.is_empty() {
                                    title = Some(truncate(&text, 60));
                                    summary = Some(truncate(&text, 160));
                                }
                                break;
                            }
                        }
                    }

                    sessions.push(SessionMeta {
                        provider_id: "gemini".to_string(),
                        session_id,
                        title,
                        summary,
                        project_dir: None,
                        created_at,
                        last_active_at,
                        source_path: file_path.to_string_lossy().to_string(),
                    });
                }
            }
        }
    }

    Ok(sessions)
}

fn parse_gemini_messages(path: &Path) -> Result<Vec<SessionMessage>, String> {
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let obj: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    let mut messages = Vec::new();

    if let Some(msgs) = obj.get("messages").and_then(|v| v.as_array()) {
        for msg in msgs {
            let msg_type = msg
                .get("type")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            let role = match msg_type {
                "gemini" => "assistant".to_string(),
                other => other.to_string(),
            };
            let content = msg
                .get("content")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            if content.is_empty() {
                continue;
            }
            let ts = parse_timestamp(msg.get("timestamp").unwrap_or(&Value::Null));
            messages.push(SessionMessage { role, content, ts });
        }
    }

    Ok(messages)
}

// OpenCode

fn resolve_opencode_storage(home: &Path) -> PathBuf {
    std::env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| home.join(".local").join("share"))
        .join("opencode")
        .join("storage")
}

fn scan_opencode(home: &Path) -> Result<Vec<SessionMeta>, String> {
    let storage = resolve_opencode_storage(home);
    let session_dir = storage.join("session");
    if !session_dir.is_dir() {
        return Ok(Vec::new());
    }

    let files = collect_files_recursive(&session_dir, "json");
    let mut sessions = Vec::new();

    for file_path in files {
        let content = match fs::read_to_string(&file_path) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let obj: Value = match serde_json::from_str(&content) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let session_id = obj
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if session_id.is_empty() {
            continue;
        }

        let title = obj
            .get("title")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let project_dir = obj
            .get("directory")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let created_at = obj
            .get("time")
            .and_then(|t| t.get("created"))
            .and_then(|v| parse_timestamp(v));
        let last_active_at = obj
            .get("time")
            .and_then(|t| t.get("updated"))
            .and_then(|v| parse_timestamp(v))
            .or_else(|| file_modified_ms(&file_path));

        let summary = title
            .clone()
            .or_else(|| project_dir.as_deref().and_then(path_basename));

        // Store the message directory in source_path for load_session_messages
        let msg_dir = storage.join("message").join(&session_id);

        sessions.push(SessionMeta {
            provider_id: "opencode".to_string(),
            session_id,
            title,
            summary,
            project_dir,
            created_at,
            last_active_at,
            source_path: msg_dir.to_string_lossy().to_string(),
        });
    }

    Ok(sessions)
}

fn parse_opencode_messages(path: &Path) -> Result<Vec<SessionMessage>, String> {
    // The path points to the message/<session_id>/ directory
    if !path.is_dir() {
        return Ok(Vec::new());
    }

    let storage = path
        .parent()
        .and_then(|p| p.parent())
        .ok_or("无法确定 storage 目录")?;
    let parts_root = storage.join("part");

    let msg_files = collect_files_recursive(path, "json");
    let mut raw_messages: Vec<(Option<u64>, String, String)> = Vec::new(); // (ts, role, content)

    for msg_file in msg_files {
        let content = match fs::read_to_string(&msg_file) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let obj: Value = match serde_json::from_str(&content) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let msg_id = obj
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let role = obj
            .get("role")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();
        let ts = obj
            .get("time")
            .and_then(|t| t.get("created"))
            .and_then(|v| parse_timestamp(v));

        let mut text_parts = Vec::new();
        let part_dir = parts_root.join(&msg_id);
        if part_dir.is_dir() {
            let part_files = collect_files_recursive(&part_dir, "json");
            for part_file in part_files {
                let part_content = match fs::read_to_string(&part_file) {
                    Ok(c) => c,
                    Err(_) => continue,
                };
                let part_obj: Value = match serde_json::from_str(&part_content) {
                    Ok(v) => v,
                    Err(_) => continue,
                };
                if part_obj.get("type").and_then(|v| v.as_str()) == Some("text") {
                    if let Some(text) = part_obj.get("text").and_then(|v| v.as_str()) {
                        text_parts.push(text.to_string());
                    }
                }
            }
        }

        let full_text = text_parts.join("\n");
        if !full_text.is_empty() {
            raw_messages.push((ts, role, full_text));
        }
    }

    raw_messages.sort_by_key(|(ts, _, _)| *ts);

    Ok(raw_messages
        .into_iter()
        .map(|(ts, role, content)| SessionMessage { role, content, ts })
        .collect())
}

// OpenClaw

fn scan_openclaw(home: &Path) -> Result<Vec<SessionMeta>, String> {
    let agents_dir = home.join(".openclaw").join("agents");
    if !agents_dir.is_dir() {
        return Ok(Vec::new());
    }

    let mut sessions = Vec::new();

    if let Ok(agent_entries) = fs::read_dir(&agents_dir) {
        for agent_entry in agent_entries.flatten() {
            let sessions_dir = agent_entry.path().join("sessions");
            if !sessions_dir.is_dir() {
                continue;
            }

            let files = collect_files_recursive(&sessions_dir, "jsonl");
            for file_path in files {
                // Skip sessions.json if it appears among the session logs
                if file_path.file_name().and_then(|n| n.to_str()) == Some("sessions.json") {
                    continue;
                }

                let head = read_head_lines(&file_path, 10);
                let tail = read_tail_lines(&file_path, 30);

                let mut session_id = None;
                let mut cwd = None;
                let mut created_at = None;
                let mut summary = None;

                for line in &head {
                    if let Ok(obj) = serde_json::from_str::<Value>(line) {
                        if obj.get("type").and_then(|v| v.as_str()) == Some("session") {
                            session_id = obj
                                .get("id")
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string());
                            cwd = obj
                                .get("cwd")
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string());
                            created_at =
                                parse_timestamp(obj.get("timestamp").unwrap_or(&Value::Null));
                        }
                        if summary.is_none()
                            && obj.get("type").and_then(|v| v.as_str()) == Some("message")
                        {
                            if let Some(msg) = obj.get("message") {
                                let text = extract_text(msg.get("content").unwrap_or(&Value::Null));
                                if !text.is_empty() {
                                    summary = Some(truncate(&text, 160));
                                }
                            }
                        }
                    }
                }

                let mut last_active_at = None;
                for line in tail.iter().rev() {
                    if let Ok(obj) = serde_json::from_str::<Value>(line) {
                        last_active_at =
                            parse_timestamp(obj.get("timestamp").unwrap_or(&Value::Null));
                        if last_active_at.is_some() {
                            break;
                        }
                    }
                }

                if last_active_at.is_none() {
                    last_active_at = file_modified_ms(&file_path);
                }

                let sid = session_id.unwrap_or_else(|| {
                    file_path
                        .file_stem()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string()
                });
                let title = cwd.as_deref().and_then(path_basename);

                sessions.push(SessionMeta {
                    provider_id: "openclaw".to_string(),
                    session_id: sid,
                    title,
                    summary,
                    project_dir: cwd,
                    created_at,
                    last_active_at,
                    source_path: file_path.to_string_lossy().to_string(),
                });
            }
        }
    }

    Ok(sessions)
}

fn parse_openclaw_messages(path: &Path) -> Result<Vec<SessionMessage>, String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);
    let mut messages = Vec::new();

    for line in reader.lines() {
        let line = line.map_err(|e| e.to_string())?;
        if let Ok(obj) = serde_json::from_str::<Value>(&line) {
            if obj.get("type").and_then(|v| v.as_str()) != Some("message") {
                continue;
            }
            if let Some(msg) = obj.get("message") {
                let raw_role = msg
                    .get("role")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown");
                let role = match raw_role {
                    "toolResult" => "tool".to_string(),
                    other => other.to_string(),
                };
                let content = extract_text(msg.get("content").unwrap_or(&Value::Null));
                if content.is_empty() {
                    continue;
                }
                let ts = parse_timestamp(obj.get("timestamp").unwrap_or(&Value::Null));
                messages.push(SessionMessage { role, content, ts });
            }
        }
    }

    Ok(messages)
}
