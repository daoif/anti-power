//! Cache cleanup
//!
//! Clear conversation caches on macOS and Linux

/// Embedded cleanup script
const ANTI_CLEAN_SCRIPT_ZH: &str =
    include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/../patches/anti-clean.sh"));
const ANTI_CLEAN_SCRIPT_EN: &str =
    include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/../patches/anti-clean.en.sh"));

fn is_zh_locale(locale: Option<&str>) -> bool {
    if let Some(value) = locale {
        let lower = value.to_ascii_lowercase();
        return lower.starts_with("zh");
    }
    true
}

/// Cleanup target selection
#[derive(serde::Deserialize)]
pub struct CleanTargets {
    pub antigravity: bool,
    pub gemini: bool,
    pub codex: bool,
    pub claude: bool,
}

/// Run the cleanup script
///
/// # Arguments
/// - `force`: Clear additional cache data
/// - `targets`: Apps selected for cleanup
/// - `locale`: Current UI language (zh-CN/en-US)
///
/// # Returns
/// - `Ok(String)`: Script output on success
/// - `Err(String)`: Error message on failure
#[tauri::command]
pub fn run_anti_clean(
    force: bool,
    targets: CleanTargets,
    locale: Option<String>,
) -> Result<String, String> {
    if !cfg!(any(target_os = "macos", target_os = "linux")) {
        return Err("该功能仅支持 macOS/Linux".to_string());
    }
    run_anti_clean_unix(force, targets, locale.as_deref())
}

/// Run the Unix cleanup script
#[cfg(any(target_os = "macos", target_os = "linux"))]
fn run_anti_clean_unix(
    force: bool,
    targets: CleanTargets,
    locale: Option<&str>,
) -> Result<String, String> {
    use std::fs;
    use std::os::unix::fs::PermissionsExt;
    use std::process::Command;

    if !targets.antigravity && !targets.gemini && !targets.codex && !targets.claude {
        return Err("未选择清理目标".to_string());
    }

    let script_content = if is_zh_locale(locale) {
        ANTI_CLEAN_SCRIPT_ZH
    } else {
        ANTI_CLEAN_SCRIPT_EN
    };

    let mut script_path = std::env::temp_dir();
    script_path.push("anti-clean.sh");

    fs::write(&script_path, script_content)
        .map_err(|e| format!("写入临时脚本失败: {}", e))?;
    
    let perm = fs::Permissions::from_mode(0o700);
    fs::set_permissions(&script_path, perm)
        .map_err(|e| format!("设置脚本权限失败: {}", e))?;

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

    let output = cmd.output().map_err(|e| format!("执行脚本失败: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    let _ = fs::remove_file(&script_path);

    if !output.status.success() {
        if stderr.is_empty() {
            return Err(stdout);
        }
        if stdout.is_empty() {
            return Err(stderr);
        }
        return Err(format!("{}\n{}", stdout, stderr));
    }

    Ok(stdout)
}

/// Return an unsupported-platform error on non-Unix systems
#[cfg(not(any(target_os = "macos", target_os = "linux")))]
fn run_anti_clean_unix(
    _force: bool,
    _targets: CleanTargets,
    _locale: Option<&str>,
) -> Result<String, String> {
    Err("该功能仅支持 macOS/Linux".to_string())
}
