// Anti-Power Patcher Rust 后端.
// 负责路径检测, 补丁安装/卸载, 配置读写.

mod commands;
mod embedded;

use commands::{detect_antigravity_path, normalize_antigravity_path, install_patch, uninstall_patch, update_config, check_patch_status, read_patch_config, read_manager_patch_config, get_config, save_config, run_anti_clean};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                #[cfg(target_os = "macos")]
                {
                    let _ = window.set_decorations(true);
                    let _ = window.set_title_bar_style(tauri::TitleBarStyle::Overlay);
                    let _ = window.set_title("");
                }
                #[cfg(not(target_os = "macos"))]
                {
                    let _ = window.set_decorations(false);
                }
            }
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            detect_antigravity_path,
            normalize_antigravity_path,
            install_patch,
            uninstall_patch,
            update_config,
            check_patch_status,
            read_patch_config,
            read_manager_patch_config,
            get_config,
            save_config,
            run_anti_clean
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
