//! Session history
//!
//! Browse and clean local Antigravity App and Antigravity CLI sessions

use super::antigravity_store::{CLI, DESKTOP};
use super::{antigravity_clean, antigravity_scan};

use serde::{Deserialize, Serialize};
use std::cmp::Reverse;
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
    pub last_active_at: Option<u64>,
    pub source_path: String,
    /// This source holds index entries but no conversation files for the session
    pub index_only: bool,
}

/// Scan results, with the stores whose interrupted cleanup could not be recovered
#[derive(Debug, Serialize)]
pub struct SessionList {
    pub sessions: Vec<SessionMeta>,
    pub warnings: Vec<String>,
}

/// A session selected for deletion
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionRef {
    pub provider_id: String,
    pub source_path: PathBuf,
    pub session_id: String,
}

/// Optional cleanup beyond the session stores
#[derive(Debug, Clone, Copy, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CleanOptions {
    /// Remove session sync records from CC Switch and its backups
    pub cc_switch: bool,
    /// Empty the Antigravity App's Chromium caches
    pub app_cache: bool,
}

/// Per-session deletion errors in order, plus post-commit cleanup warnings
#[derive(Debug, Serialize)]
pub struct DeleteReport {
    pub errors: Vec<Option<String>>,
    pub warnings: Vec<String>,
}

/// A single session message
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionMessage {
    pub role: String,
    pub content: String,
    pub ts: Option<u64>,
}

fn home_dir() -> Result<PathBuf, String> {
    std::env::home_dir().ok_or_else(|| "Cannot find the home directory".to_owned())
}

/// List session metadata without loading message bodies
#[tauri::command(async)]
pub fn scan_sessions() -> Result<SessionList, String> {
    let home = home_dir()?;
    let mut sessions = Vec::new();
    let mut warnings = Vec::new();
    for provider in [DESKTOP, CLI] {
        warnings.append(&mut antigravity_clean::recover_pending(&home, provider));
        sessions.append(&mut antigravity_scan::scan(&home, provider)?);
    }
    sessions.sort_by_key(|session| Reverse(session.last_active_at));
    Ok(SessionList { sessions, warnings })
}

/// Load a session's messages on demand
#[tauri::command(async)]
pub fn load_session_messages(
    provider_id: String,
    source_path: String,
) -> Result<Vec<SessionMessage>, String> {
    antigravity_scan::load_messages(&home_dir()?, &provider_id, Path::new(&source_path))
}

/// Delete sessions and optional external data
#[tauri::command(async)]
pub fn delete_sessions(
    sessions: Vec<SessionRef>,
    options: Option<CleanOptions>,
) -> Result<DeleteReport, String> {
    Ok(antigravity_clean::delete(
        &home_dir()?,
        &sessions,
        options.unwrap_or_default(),
    ))
}
