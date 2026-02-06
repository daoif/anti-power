//! 清理模块
//!
//! 提供对话缓存清理功能

use super::i18n::{self, CommandError};

type CleanResult<T> = Result<T, CommandError>;

/// Unix 清理脚本
const ANTI_CLEAN_SCRIPT_ZH: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../patches/anti-clean.sh"
));
const ANTI_CLEAN_SCRIPT_EN: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../patches/anti-clean.en.sh"
));

#[cfg(target_os = "windows")]
const TRAJECTORY_SUMMARIES_KEY: &str = "antigravityUnifiedStateSync.trajectorySummaries";

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn is_zh_locale(locale: Option<&str>) -> bool {
    i18n::is_zh_locale(locale)
}

fn clean_text(locale: Option<&str>, key: &str) -> String {
    i18n::text(locale, key)
}

fn clean_error(_locale: Option<&str>, key: &'static str) -> CommandError {
    CommandError::key(key)
}

#[cfg(target_os = "windows")]
fn apply_vars(template: String, vars: &[(&str, String)]) -> String {
    let mut message = template;
    for (name, value) in vars {
        message = message.replace(&format!("{{{}}}", name), value);
    }
    message
}

/// 清理目标配置
#[derive(serde::Deserialize)]
pub struct CleanTargets {
    pub antigravity: bool,
    pub gemini: bool,
    pub codex: bool,
    pub claude: bool,
}

impl CleanTargets {
    /// 是否至少选择了一个清理目标
    fn has_any(&self) -> bool {
        self.antigravity || self.gemini || self.codex || self.claude
    }
}

/// 运行清理流程（按平台分发实现）
#[tauri::command]
pub fn run_anti_clean(
    force: bool,
    targets: CleanTargets,
    locale: Option<String>,
) -> Result<String, String> {
    let locale_ref = locale.as_deref();
    run_anti_clean_internal(force, targets, locale_ref).map_err(|err| err.to_message(locale_ref))
}

fn run_anti_clean_internal(
    force: bool,
    targets: CleanTargets,
    locale: Option<&str>,
) -> CleanResult<String> {
    if !targets.has_any() {
        return Err(clean_error(locale, "cleanBackend.errors.noTarget"));
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        run_anti_clean_unix(force, targets, locale)
    }

    #[cfg(target_os = "windows")]
    {
        run_anti_clean_windows(force, targets, locale)
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        let _ = (force, targets, locale);
        Err(clean_error(None, "cleanBackend.errors.unsupportedPlatform"))
    }
}

/// Unix 平台清理实现
#[cfg(any(target_os = "macos", target_os = "linux"))]
fn run_anti_clean_unix(
    force: bool,
    targets: CleanTargets,
    locale: Option<&str>,
) -> CleanResult<String> {
    use std::fs;
    use std::os::unix::fs::PermissionsExt;
    use std::process::Command;

    let script_content = if is_zh_locale(locale) {
        ANTI_CLEAN_SCRIPT_ZH
    } else {
        ANTI_CLEAN_SCRIPT_EN
    };

    // 写入临时脚本
    let mut script_path = std::env::temp_dir();
    script_path.push("anti-clean.sh");

    fs::write(&script_path, script_content).map_err(|e| {
        format!(
            "{}: {}",
            clean_text(locale, "cleanBackend.errors.writeTempScriptFailed"),
            e
        )
    })?;

    // 设置脚本可执行权限
    let perm = fs::Permissions::from_mode(0o700);
    fs::set_permissions(&script_path, perm).map_err(|e| {
        format!(
            "{}: {}",
            clean_text(locale, "cleanBackend.errors.setScriptPermissionsFailed"),
            e
        )
    })?;

    // 构建命令
    let mut cmd = Command::new("/bin/bash");
    cmd.arg(&script_path);
    if force {
        cmd.arg("--force");
    }
    if targets.antigravity {
        cmd.arg("--antigravity");
    }
    if targets.gemini {
        cmd.arg("--gemini");
    }
    if targets.codex {
        cmd.arg("--codex");
    }
    if targets.claude {
        cmd.arg("--claude");
    }

    // 执行脚本
    let output = cmd.output().map_err(|e| {
        format!(
            "{}: {}",
            clean_text(locale, "cleanBackend.errors.executeScriptFailed"),
            e
        )
    })?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    // 清理临时脚本
    let _ = fs::remove_file(&script_path);

    // 检查执行结果
    if !output.status.success() {
        if stderr.is_empty() {
            return Err(CommandError::from(stdout));
        }
        if stdout.is_empty() {
            return Err(CommandError::from(stderr));
        }
        return Err(CommandError::from(format!("{}\n{}", stdout, stderr)));
    }

    Ok(stdout)
}

/// Windows 清理实现
#[cfg(target_os = "windows")]
fn run_anti_clean_windows(
    force: bool,
    targets: CleanTargets,
    locale: Option<&str>,
) -> CleanResult<String> {
    use std::time::{SystemTime, UNIX_EPOCH};

    let home_dir = resolve_home_dir()
        .ok_or_else(|| clean_error(locale, "cleanBackend.errors.homeDirNotFound"))?;

    if !force {
        let running_processes = list_running_processes_windows(locale)?;

        if targets.antigravity {
            check_running_windows("Antigravity", "antigravity", &running_processes, locale)?;
        }
        if targets.gemini {
            check_running_windows("Gemini CLI", "gemini", &running_processes, locale)?;
        }
        if targets.codex {
            check_running_windows("Codex", "codex", &running_processes, locale)?;
        }
        if targets.claude {
            check_running_windows("Claude Code", "claude", &running_processes, locale)?;
        }
    }

    let mut output_lines = Vec::new();

    if targets.antigravity {
        let data_dir = resolve_antigravity_data_dir()
            .ok_or_else(|| clean_error(locale, "cleanBackend.errors.antigravityDataDirNotFound"))?;

        if !data_dir.exists() {
            return Err(CommandError::from(format!(
                "{} {}",
                clean_text(locale, "cleanBackend.errors.dataDirNotFound"),
                data_dir.display()
            )));
        }

        if !has_sqlite3() {
            return Err(clean_error(locale, "cleanBackend.errors.sqlite3Missing"));
        }

        let db_dir = data_dir.join("User").join("globalStorage");
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
            .to_string();

        output_lines.push(format!(
            "\n[Antigravity] {}",
            clean_text(locale, "cleanBackend.sections.antigravity.backupDb")
        ));
        backup_file(
            &db_dir.join("state.vscdb"),
            &timestamp,
            locale,
            &mut output_lines,
        )?;
        backup_file(
            &db_dir.join("state.vscdb.backup"),
            &timestamp,
            locale,
            &mut output_lines,
        )?;

        output_lines.push(format!(
            "\n[Antigravity] {}",
            clean_text(locale, "cleanBackend.sections.antigravity.cleanDb")
        ));
        clean_db(&db_dir.join("state.vscdb"), locale, &mut output_lines)?;
        clean_db(
            &db_dir.join("state.vscdb.backup"),
            locale,
            &mut output_lines,
        )?;

        output_lines.push(format!(
            "\n[Antigravity] {}",
            clean_text(locale, "cleanBackend.sections.shared.cleanCache")
        ));
        clean_dir_contents(
            &home_dir
                .join(".gemini")
                .join("antigravity")
                .join("annotations"),
            locale,
            &mut output_lines,
        )?;
        clean_dir_contents(
            &home_dir.join(".gemini").join("antigravity").join("brain"),
            locale,
            &mut output_lines,
        )?;
        clean_dir_contents(
            &home_dir
                .join(".gemini")
                .join("antigravity")
                .join("browser_recordings"),
            locale,
            &mut output_lines,
        )?;
        clean_dir_contents(
            &home_dir
                .join(".gemini")
                .join("antigravity")
                .join("code_tracker")
                .join("active"),
            locale,
            &mut output_lines,
        )?;
        clean_dir_contents(
            &home_dir
                .join(".gemini")
                .join("antigravity")
                .join("code_tracker")
                .join("history"),
            locale,
            &mut output_lines,
        )?;
        clean_dir_contents(
            &home_dir
                .join(".gemini")
                .join("antigravity")
                .join("conversations"),
            locale,
            &mut output_lines,
        )?;
        clean_dir_contents(
            &home_dir
                .join(".gemini")
                .join("antigravity")
                .join("implicit"),
            locale,
            &mut output_lines,
        )?;
    }

    if targets.gemini {
        output_lines.push(format!(
            "\n[Gemini CLI] {}",
            clean_text(locale, "cleanBackend.sections.shared.cleanCache")
        ));
        clean_dir_contents(
            &home_dir.join(".gemini").join("tmp"),
            locale,
            &mut output_lines,
        )?;
    }

    if targets.codex {
        output_lines.push(format!(
            "\n[Codex] {}",
            clean_text(locale, "cleanBackend.sections.codex.cleanArchive")
        ));
        clean_dir_contents(
            &home_dir.join(".codex").join("archived_sessions"),
            locale,
            &mut output_lines,
        )?;
    }

    if targets.claude {
        output_lines.push(format!(
            "\n[Claude Code] {}",
            clean_text(locale, "cleanBackend.sections.shared.cleanCache")
        ));
        clean_dir_contents(
            &home_dir.join(".claude").join("projects"),
            locale,
            &mut output_lines,
        )?;
        clean_dir_contents(
            &home_dir.join(".claude").join("file-history"),
            locale,
            &mut output_lines,
        )?;
        clean_dir_contents(
            &home_dir.join(".claude").join("session-env"),
            locale,
            &mut output_lines,
        )?;
        clean_dir_contents(
            &home_dir.join(".claude").join("shell-snapshots"),
            locale,
            &mut output_lines,
        )?;
        clean_dir_contents(
            &home_dir.join(".claude").join("todos"),
            locale,
            &mut output_lines,
        )?;
        clean_dir_contents(
            &home_dir.join(".claude").join("debug"),
            locale,
            &mut output_lines,
        )?;
        clean_file(
            &home_dir.join(".claude").join("history.jsonl"),
            locale,
            &mut output_lines,
        )?;
    }

    output_lines.push(format!("\n{}", clean_text(locale, "cleanBackend.done")));
    Ok(output_lines.join("\n"))
}

/// Windows: 目录定位
#[cfg(target_os = "windows")]
fn resolve_home_dir() -> Option<std::path::PathBuf> {
    dirs::home_dir().or_else(|| std::env::var_os("USERPROFILE").map(std::path::PathBuf::from))
}

/// Windows: Antigravity 数据目录定位
#[cfg(target_os = "windows")]
fn resolve_antigravity_data_dir() -> Option<std::path::PathBuf> {
    dirs::config_dir()
        .map(|dir| dir.join("Antigravity"))
        .or_else(|| {
            std::env::var_os("APPDATA")
                .map(|value| std::path::PathBuf::from(value).join("Antigravity"))
        })
}

#[cfg(target_os = "windows")]
fn has_sqlite3() -> bool {
    new_windows_command("sqlite3")
        .arg("--version")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

#[cfg(target_os = "windows")]
fn new_windows_command(program: &str) -> std::process::Command {
    use std::os::windows::process::CommandExt;

    let mut command = std::process::Command::new(program);
    command.creation_flags(CREATE_NO_WINDOW);
    command
}

/// Windows: 运行中检测
#[cfg(target_os = "windows")]
fn list_running_processes_windows(locale: Option<&str>) -> CleanResult<String> {
    let output = new_windows_command("tasklist").output().map_err(|e| {
        format!(
            "{}: {}",
            clean_text(locale, "cleanBackend.errors.tasklistExecFailed"),
            e
        )
    })?;

    if !output.status.success() {
        return Err(clean_error(
            locale,
            "cleanBackend.errors.tasklistExecFailed",
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_ascii_lowercase())
}

#[cfg(target_os = "windows")]
fn check_running_windows(
    name: &str,
    pattern: &str,
    listing: &str,
    locale: Option<&str>,
) -> CleanResult<()> {
    if !listing.contains(pattern) {
        return Ok(());
    }

    Err(CommandError::from(apply_vars(
        clean_text(locale, "cleanBackend.errors.runningDetected"),
        &[("name", name.to_string())],
    )))
}

/// Windows: 数据库清理
#[cfg(target_os = "windows")]
fn backup_file(
    source: &std::path::Path,
    timestamp: &str,
    locale: Option<&str>,
    output_lines: &mut Vec<String>,
) -> CleanResult<()> {
    if !source.exists() {
        return Ok(());
    }

    let name = source
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("unknown");
    let backup_name = format!("{}.bak.{}", name, timestamp);
    let backup_path = source.with_file_name(&backup_name);

    std::fs::copy(source, &backup_path).map_err(|e| {
        format!(
            "{} {}: {}",
            clean_text(locale, "cleanBackend.errors.backupFileFailed"),
            source.display(),
            e
        )
    })?;

    output_lines.push(apply_vars(
        clean_text(locale, "cleanBackend.logs.backup"),
        &[("name", name.to_string()), ("backup", backup_name.clone())],
    ));

    Ok(())
}

#[cfg(target_os = "windows")]
fn clean_db(
    db_path: &std::path::Path,
    locale: Option<&str>,
    output_lines: &mut Vec<String>,
) -> CleanResult<()> {
    if !db_path.exists() {
        let name = db_path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("unknown");
        output_lines.push(format!(
            "{}: {}",
            clean_text(locale, "cleanBackend.labels.skipNotFound"),
            name
        ));
        return Ok(());
    }

    let (before, after) = sqlite_clean_and_count(db_path, locale)?;

    let name = db_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("unknown");
    output_lines.push(apply_vars(
        clean_text(locale, "cleanBackend.logs.cleanedDb"),
        &[
            ("name", name.to_string()),
            ("before", before.to_string()),
            ("after", after.to_string()),
        ],
    ));

    Ok(())
}

#[cfg(target_os = "windows")]
fn sqlite_clean_and_count(
    db_path: &std::path::Path,
    locale: Option<&str>,
) -> CleanResult<(i64, i64)> {
    let sql = format!(
        "select count(*) from ItemTable where key='{}';\ndelete from ItemTable where key='{}';\nselect count(*) from ItemTable where key='{}';",
        TRAJECTORY_SUMMARIES_KEY,
        TRAJECTORY_SUMMARIES_KEY,
        TRAJECTORY_SUMMARIES_KEY
    );

    let output = new_windows_command("sqlite3")
        .arg(db_path)
        .arg(sql)
        .output()
        .map_err(|e| {
            format!(
                "{} {}: {}",
                clean_text(locale, "cleanBackend.errors.sqlite3ExecFailed"),
                db_path.display(),
                e
            )
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if !stderr.is_empty() { stderr } else { stdout };
        return Err(CommandError::from(format!(
            "{} {}: {}",
            clean_text(locale, "cleanBackend.errors.sqliteCleanFailed"),
            db_path.display(),
            detail
        )));
    }

    let counts: Vec<i64> = String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .filter_map(|line| line.parse::<i64>().ok())
        .collect();

    if counts.len() < 2 {
        return Err(CommandError::from(format!(
            "{} {}",
            clean_text(locale, "cleanBackend.errors.sqliteCountFailed"),
            db_path.display()
        )));
    }

    Ok((counts[0], *counts.last().unwrap_or(&counts[0])))
}

/// Windows: 文件系统清理
#[cfg(target_os = "windows")]
fn clean_dir_contents(
    path: &std::path::Path,
    locale: Option<&str>,
    output_lines: &mut Vec<String>,
) -> CleanResult<()> {
    if !path.exists() {
        output_lines.push(format!(
            "{}: {}",
            clean_text(locale, "cleanBackend.labels.skipDirMissing"),
            path.display()
        ));
        return Ok(());
    }

    if !path.is_dir() {
        output_lines.push(format!(
            "{}: {}",
            clean_text(locale, "cleanBackend.labels.skipNotDir"),
            path.display()
        ));
        return Ok(());
    }

    output_lines.push(format!(
        "{}: {}",
        clean_text(locale, "cleanBackend.labels.cleanDirContents"),
        path.display()
    ));

    for entry in std::fs::read_dir(path).map_err(|e| {
        format!(
            "{} {}: {}",
            clean_text(locale, "cleanBackend.errors.readDirFailed"),
            path.display(),
            e
        )
    })? {
        let entry = entry.map_err(|e| {
            format!(
                "{} {}: {}",
                clean_text(locale, "cleanBackend.errors.readDirEntryFailed"),
                path.display(),
                e
            )
        })?;
        let item_path = entry.path();
        let file_type = entry.file_type().map_err(|e| {
            format!(
                "{} {}: {}",
                clean_text(locale, "cleanBackend.errors.readFileTypeFailed"),
                item_path.display(),
                e
            )
        })?;

        if file_type.is_dir() {
            std::fs::remove_dir_all(&item_path).map_err(|e| {
                format!(
                    "{} {}: {}",
                    clean_text(locale, "cleanBackend.errors.removeDirFailed"),
                    item_path.display(),
                    e
                )
            })?;
        } else {
            std::fs::remove_file(&item_path).map_err(|e| {
                format!(
                    "{} {}: {}",
                    clean_text(locale, "cleanBackend.errors.removeFileFailed"),
                    item_path.display(),
                    e
                )
            })?;
        }
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn clean_file(
    path: &std::path::Path,
    locale: Option<&str>,
    output_lines: &mut Vec<String>,
) -> CleanResult<()> {
    if !path.exists() {
        output_lines.push(format!(
            "{}: {}",
            clean_text(locale, "cleanBackend.labels.skipFileMissing"),
            path.display()
        ));
        return Ok(());
    }

    std::fs::remove_file(path).map_err(|e| {
        format!(
            "{} {}: {}",
            clean_text(locale, "cleanBackend.errors.removeFileFailed"),
            path.display(),
            e
        )
    })?;

    output_lines.push(format!(
        "{}: {}",
        clean_text(locale, "cleanBackend.labels.deletedFile"),
        path.display()
    ));
    Ok(())
}
