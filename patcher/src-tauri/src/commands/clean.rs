const ANTI_CLEAN_SCRIPT: &str =
    include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/../patches/anti-clean.sh"));

#[tauri::command]
pub fn run_anti_clean(force: bool) -> Result<String, String> {
    if !cfg!(any(target_os = "macos", target_os = "linux")) {
        return Err("该功能仅支持 macOS / Linux".to_string());
    }
    run_anti_clean_unix(force)
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn run_anti_clean_unix(force: bool) -> Result<String, String> {
    use std::fs;
    use std::os::unix::fs::PermissionsExt;
    use std::process::Command;

    let mut script_path = std::env::temp_dir();
    script_path.push("anti-clean.sh");

    fs::write(&script_path, ANTI_CLEAN_SCRIPT)
        .map_err(|e| format!("写入临时脚本失败: {}", e))?;
    let perm = fs::Permissions::from_mode(0o700);
    fs::set_permissions(&script_path, perm)
        .map_err(|e| format!("设置脚本权限失败: {}", e))?;

    let mut cmd = Command::new("/bin/bash");
    cmd.arg(&script_path);
    if force {
        cmd.arg("--force");
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

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
fn run_anti_clean_unix(_force: bool) -> Result<String, String> {
    Err("该功能仅支持 macOS / Linux".to_string())
}
