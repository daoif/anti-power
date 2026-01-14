// Antigravity installation discovery
// Windows detection checks the registry before common paths
// macOS detection placeholder for community contributions

use std::path::PathBuf;

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

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        None
    }
}

/// Check whether the path is a valid Antigravity installation root
fn is_valid_antigravity_path(path: &PathBuf) -> bool {
    let cascade_panel_path = path
        .join("resources")
        .join("app")
        .join("extensions")
        .join("antigravity")
        .join("cascade-panel.html");
    
    cascade_panel_path.exists()
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
                let path = PathBuf::from(&install_location);
                if is_valid_antigravity_path(&path) {
                    return Some(install_location);
                }
            }
        }
    }

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    for reg_path in paths {
        if let Ok(key) = hkcu.open_subkey(reg_path) {
            if let Ok(install_location) = key.get_value::<String, _>("InstallLocation") {
                let path = PathBuf::from(&install_location);
                if is_valid_antigravity_path(&path) {
                    return Some(install_location);
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
        let path = PathBuf::from(path_str);
        if is_valid_antigravity_path(&path) {
            return Some(path_str.to_string());
        }
    }

    if let Some(local_data) = dirs::data_local_dir() {
        let user_path = local_data.join("Programs").join("Antigravity");
        if is_valid_antigravity_path(&user_path) {
            return user_path.to_str().map(String::from);
        }
    }

    None
}

// macOS detection
#[cfg(target_os = "macos")]
fn detect_macos() -> Option<String> {
    let standard_paths = [
        "/Applications/Antigravity.app",
    ];

    for path_str in standard_paths {
        let path = PathBuf::from(path_str);
        if is_valid_antigravity_path(&path) {
            return Some(path_str.to_string());
        }
    }

    if let Some(home) = dirs::home_dir() {
        let user_app = home.join("Applications").join("Antigravity.app");
        if is_valid_antigravity_path(&user_app) {
            return user_app.to_str().map(String::from);
        }
    }

    None
}
