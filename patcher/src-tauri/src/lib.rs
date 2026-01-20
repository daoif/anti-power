// Anti-Power Patcher Rust backend
// Find installations, apply and remove patches, and manage configuration

mod commands;
mod embedded;

use commands::{detect_antigravity_path, install_patch, uninstall_patch, update_config, check_patch_status, read_patch_config, read_manager_patch_config, get_config, save_config};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            detect_antigravity_path,
            install_patch,
            uninstall_patch,
            update_config,
            check_patch_status,
            read_patch_config,
            read_manager_patch_config,
            get_config,
            save_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
