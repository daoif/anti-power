//! 路径检测模块
//!
//! 自动检测 Antigravity 安装路径
//! - Windows: 注册表查询 + 常见路径扫描
//! - macOS/Linux: 标准路径探测，未命中时返回 None

use super::paths;
use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

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

/// Antigravity 版本信息
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AntigravityVersionInfo {
    /// product.json 中的 ideVersion（可能为空）
    pub ide_version: Option<String>,
    /// 侧边栏补丁模式: legacy 或 modern
    pub sidebar_variant: String,
}

/// 检测 Antigravity ideVersion 与侧边栏补丁模式
#[tauri::command]
pub fn detect_antigravity_version(path: String) -> Option<AntigravityVersionInfo> {
    let normalized = normalize_path(Path::new(&path))?;
    let resources_root = paths::resources_app_root(Path::new(&normalized));

    let ide_version = read_ide_version(&resources_root);
    let sidebar_variant = detect_sidebar_variant(ide_version.as_deref()).to_string();

    Some(AntigravityVersionInfo {
        ide_version,
        sidebar_variant,
    })
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

const MODERN_SIDEBAR_THRESHOLD: (u32, u32, u32) = (1, 18, 3);

fn read_ide_version(resources_root: &Path) -> Option<String> {
    let product_json_path = resources_root.join("product.json");
    let content = fs::read_to_string(product_json_path).ok()?;
    let json: Value = serde_json::from_str(&content).ok()?;
    json.get("ideVersion")?
        .as_str()
        .map(|version| version.to_string())
}

fn detect_sidebar_variant(ide_version: Option<&str>) -> &'static str {
    match ide_version.and_then(parse_version_triplet) {
        Some(version) if version >= MODERN_SIDEBAR_THRESHOLD => "modern",
        _ => "legacy",
    }
}

fn parse_version_triplet(raw: &str) -> Option<(u32, u32, u32)> {
    let mut parts = raw.trim().split('.');
    let major = parse_version_component(parts.next()?)?;
    let minor = parse_version_component(parts.next().unwrap_or("0"))?;
    let patch = parse_version_component(parts.next().unwrap_or("0"))?;
    Some((major, minor, patch))
}

fn parse_version_component(input: &str) -> Option<u32> {
    let digits: String = input.chars().take_while(|ch| ch.is_ascii_digit()).collect();
    if digits.is_empty() {
        return None;
    }
    digits.parse::<u32>().ok()
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

        let user_app_contents = home
            .join("Applications")
            .join("Antigravity.app")
            .join("Contents");
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
