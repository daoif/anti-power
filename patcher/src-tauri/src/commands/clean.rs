//! 清理模块
//!
//! 提供对话缓存清理功能（仅支持 macOS/Linux）

/// 内嵌的清理脚本内容
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

/// 清理目标配置
#[derive(serde::Deserialize)]
pub struct CleanTargets {
    pub antigravity: bool,
    pub gemini: bool,
    pub codex: bool,
    pub claude: bool,
}

/// 运行清理脚本
///
/// # 参数
/// - `force`: 是否强制清理（删除更多缓存数据）
/// - `targets`: 清理目标
/// - `locale`: 当前界面语言 (zh-CN/en-US)
///
/// # 返回
/// - `Ok(String)`: 清理成功，返回脚本输出
/// - `Err(String)`: 清理失败，返回错误信息
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

/// Unix 平台清理实现
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

    // 写入临时脚本
    let mut script_path = std::env::temp_dir();
    script_path.push("anti-clean.sh");

    fs::write(&script_path, script_content)
        .map_err(|e| format!("写入临时脚本失败: {}", e))?;
    
    // 设置脚本可执行权限
    let perm = fs::Permissions::from_mode(0o700);
    fs::set_permissions(&script_path, perm)
        .map_err(|e| format!("设置脚本权限失败: {}", e))?;

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
    let output = cmd.output().map_err(|e| format!("执行脚本失败: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    // 清理临时脚本
    let _ = fs::remove_file(&script_path);

    // 检查执行结果
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

/// 非 Unix 平台的占位实现
#[cfg(not(any(target_os = "macos", target_os = "linux")))]
fn run_anti_clean_unix(
    _force: bool,
    _targets: CleanTargets,
    _locale: Option<&str>,
) -> Result<String, String> {
    Err("该功能仅支持 macOS/Linux".to_string())
}
