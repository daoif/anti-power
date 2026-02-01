// Antigravity installation discovery
// Windows: query the registry and scan common paths
// macOS/Linux: return `None` when standard paths fail

use std::path::PathBuf;
use super::paths;

// Keep platform code here to avoid submodule path issues

/// Find the Antigravity installation path
/// Return the first valid path or `None`
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

/// Normalize the Antigravity installation path
#[tauri::command]
pub fn normalize_antigravity_path(path: String) -> Option<String> {
    let input = PathBuf::from(path);
    normalize_path(&input)
}

fn normalize_path(path: &PathBuf) -> Option<String> {
    paths::normalize_antigravity_root(path)
        .and_then(|normalized| normalized.to_str().map(|s| s.to_string()))
}

// Windows detection
#[cfg(target_os = "windows")]
fn detect_windows() -> Option<String> {
    if let Some(path) = try_registry() {
        return Some(path);
    }

    if let Some(path) = try_common_paths_windows() {
        return Some(path);
    }

    None
}

#[cfg(target_os = "windows")]
fn try_registry() -> Option<String> {
    use winreg::enums::*;
    use winreg::RegKey;

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    
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

    if let Some(local_data) = dirs::data_local_dir() {
        let user_path = local_data.join("Programs").join("Antigravity");
        if let Some(normalized) = normalize_path(&user_path) {
            return Some(normalized);
        }
    }

    None
}

// macOS detection
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

// Linux detection
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
