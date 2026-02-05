//! 路径检测模块
//!
//! 自动检测 Antigravity 安装路径
//! - Windows: 注册表查询 + 常见路径扫描
//! - macOS/Linux: 标准路径探测，未命中时返回 None

use std::path::{Path, PathBuf};
use super::paths;

// 平台特定实现直接内联，避免子模块路径问题

/// 检测 Antigravity 安装路径
/// 返回找到的第一个有效路径, 或 None
#[tauri::command]
pub fn detect_antigravity_path() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        detect_windows()
    }

    #[cfg(target_os = "macos")]
    {
        detect_macos()
    }

    #[cfg(target_os = "linux")]
    {
        detect_linux()
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        None
    }
}

/// 规范化 Antigravity 安装路径
#[tauri::command]
pub fn normalize_antigravity_path(path: String) -> Option<String> {
    let input = PathBuf::from(path);
    normalize_path(&input)
}

fn normalize_path(path: &Path) -> Option<String> {
    paths::normalize_antigravity_root(path)
        .and_then(|normalized| normalized.to_str().map(|s| s.to_string()))
}

// Windows 实现
#[cfg(target_os = "windows")]
fn detect_windows() -> Option<String> {
    // 方式 1: 尝试从注册表读取
    if let Some(path) = try_registry() {
        return Some(path);
    }

    // 方式 2: 扫描常见路径
    if let Some(path) = try_common_paths_windows() {
        return Some(path);
    }

    None
}

#[cfg(target_os = "windows")]
fn try_registry() -> Option<String> {
    use winreg::enums::*;
    use winreg::RegKey;

    // 尝试 HKEY_LOCAL_MACHINE
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    
    // Antigravity 可能的注册表路径
    let paths = [
        r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Antigravity",
        r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Antigravity",
    ];

    for reg_path in paths {
        if let Ok(key) = hklm.open_subkey(reg_path) {
            if let Ok(install_location) = key.get_value::<String, _>("InstallLocation") {
                if let Some(normalized) = normalize_path(&PathBuf::from(&install_location)) {
                    return Some(normalized);
                }
            }
        }
    }

    // 尝试 HKEY_CURRENT_USER
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    for reg_path in paths {
        if let Ok(key) = hkcu.open_subkey(reg_path) {
            if let Ok(install_location) = key.get_value::<String, _>("InstallLocation") {
                if let Some(normalized) = normalize_path(&PathBuf::from(&install_location)) {
                    return Some(normalized);
                }
            }
        }
    }

    None
}

#[cfg(target_os = "windows")]
fn try_common_paths_windows() -> Option<String> {
    let literal_paths = [
        r"C:\Program Files\Antigravity",
        r"D:\Program Files\Antigravity", 
        r"E:\Program Files\Antigravity",
    ];

    for path_str in literal_paths {
        if let Some(normalized) = normalize_path(&PathBuf::from(path_str)) {
            return Some(normalized);
        }
    }

    // 检查用户本地目录
    if let Some(local_data) = dirs::data_local_dir() {
        let user_path = local_data.join("Programs").join("Antigravity");
        if let Some(normalized) = normalize_path(&user_path) {
            return Some(normalized);
        }
    }

    None
}

// macOS 实现
#[cfg(target_os = "macos")]
fn detect_macos() -> Option<String> {
    let standard_paths = [
        "/Applications/Antigravity.app",
        "/Applications/Antigravity.app/Contents",
    ];

    for path_str in standard_paths {
        if let Some(normalized) = normalize_path(&PathBuf::from(path_str)) {
            return Some(normalized);
        }
    }

    // 检查用户 Applications 目录
    if let Some(home) = dirs::home_dir() {
        let user_app = home.join("Applications").join("Antigravity.app");
        if let Some(normalized) = normalize_path(&user_app) {
            return Some(normalized);
        }

        let user_app_contents = home.join("Applications").join("Antigravity.app").join("Contents");
        if let Some(normalized) = normalize_path(&user_app_contents) {
            return Some(normalized);
        }
    }

    None
}

// Linux 实现
#[cfg(target_os = "linux")]
fn detect_linux() -> Option<String> {
    let standard_paths = [
        "/usr/share/antigravity",
        "/usr/share/Antigravity",
        "/usr/local/share/antigravity",
        "/opt/antigravity",
        "/opt/Antigravity",
        "/usr/lib/antigravity",
        "/usr/lib64/antigravity",
    ];

    for path_str in standard_paths {
        if let Some(normalized) = normalize_path(&PathBuf::from(path_str)) {
            return Some(normalized);
        }
    }

    if let Some(data_dir) = dirs::data_dir() {
        let user_path = data_dir.join("antigravity");
        if let Some(normalized) = normalize_path(&user_path) {
            return Some(normalized);
        }
    }

    if let Some(local_data) = dirs::data_local_dir() {
        let user_path = local_data.join("antigravity");
        if let Some(normalized) = normalize_path(&user_path) {
            return Some(normalized);
        }
    }

    None
}
