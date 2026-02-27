//! 命令模块入口
//!
//! 导出所有 Tauri 命令供前端调用

mod clean;
mod config;
mod detect;
mod i18n;
mod patch;
mod paths;

pub use clean::run_anti_clean;
pub use config::{get_config, save_config};
pub use detect::{detect_antigravity_path, detect_antigravity_version, normalize_antigravity_path};
pub use patch::{
    check_patch_status, install_patch, read_manager_patch_config, read_patch_config,
    uninstall_patch, update_config,
};
