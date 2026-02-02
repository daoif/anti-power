// 命令模块入口

mod detect;
mod patch;
mod config;
mod paths;
mod clean;

pub use detect::{detect_antigravity_path, normalize_antigravity_path};
pub use patch::{install_patch, uninstall_patch, update_config, check_patch_status, read_patch_config, read_manager_patch_config};
pub use config::{get_config, save_config};
pub use clean::run_anti_clean;
