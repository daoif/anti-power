// Tauri commands

mod detect;
mod patch;
mod config;

pub use detect::detect_antigravity_path;
pub use patch::{install_patch, uninstall_patch, update_config, check_patch_status, read_patch_config};
pub use config::{get_config, save_config};
