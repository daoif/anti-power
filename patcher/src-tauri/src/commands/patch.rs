// 补丁安装与卸载模块

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::io::ErrorKind;
use std::path::PathBuf;
use crate::embedded;
use super::paths;

#[cfg(any(target_os = "macos", target_os = "linux"))]
use std::env;
#[cfg(any(target_os = "macos", target_os = "linux"))]
use std::process::Command;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

/// 需要从 product.json checksums 中移除的文件路径
/// (这些文件会被补丁修改，如果不移除校验和，Antigravity 会报"已损坏")
const CHECKSUMS_TO_REMOVE: &[&str] = &[
    "vs/code/electron-browser/workbench/workbench-jetski-agent.html",
    // 未来如果有其他需要清理的，添加到这里
];

enum PatchMode {
    Install,
    Uninstall,
    UpdateConfig,
}

impl PatchMode {
    fn as_str(&self) -> &'static str {
        match self {
            PatchMode::Install => "install",
            PatchMode::Uninstall => "uninstall",
            PatchMode::UpdateConfig => "update-config",
        }
    }
}

/// 侧边栏功能开关配置
#[derive(Debug, Serialize, Deserialize)]
#[serde(default)]
pub struct FeatureConfig {
    /// 是否启用侧边栏补丁 (禁用时还原所有侧边栏相关文件)
    pub enabled: bool,
    pub mermaid: bool,
    pub math: bool,
    #[serde(rename = "copyButton")]
    pub copy_button: bool,
    #[serde(rename = "tableColor")]
    pub table_color: bool,
    #[serde(rename = "fontSizeEnabled")]
    pub font_size_enabled: bool,
    #[serde(rename = "fontSize")]
    pub font_size: f32,
    // 复制按钮子选项
    #[serde(rename = "copyButtonSmartHover")]
    pub copy_button_smart_hover: bool,
    #[serde(rename = "copyButtonShowBottom")]
    pub copy_button_bottom_position: String,
    #[serde(rename = "copyButtonStyle")]
    pub copy_button_style: String,
    #[serde(rename = "copyButtonCustomText")]
    pub copy_button_custom_text: String,
}

impl Default for FeatureConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            mermaid: true,
            math: true,
            copy_button: true,
            table_color: true,
            font_size_enabled: true,
            font_size: 20.0,
            copy_button_smart_hover: false,
            copy_button_bottom_position: "float".to_string(),
            copy_button_style: "arrow".to_string(),
            copy_button_custom_text: "".to_string(),
        }
    }
}

/// Manager 窗口功能开关配置
#[derive(Debug, Serialize, Deserialize)]
#[serde(default)]
pub struct ManagerFeatureConfig {
    /// 是否启用 Manager 补丁 (禁用时还原所有 Manager 相关文件)
    pub enabled: bool,
    pub mermaid: bool,
    pub math: bool,
    #[serde(rename = "copyButton")]
    pub copy_button: bool,
    #[serde(rename = "maxWidthEnabled")]
    pub max_width_enabled: bool,
    #[serde(rename = "maxWidthRatio")]
    pub max_width_ratio: f32,
    #[serde(rename = "fontSizeEnabled")]
    pub font_size_enabled: bool,
    #[serde(rename = "fontSize")]
    pub font_size: f32,
    // 复制按钮子选项
    #[serde(rename = "copyButtonSmartHover")]
    pub copy_button_smart_hover: bool,
    #[serde(rename = "copyButtonShowBottom")]
    pub copy_button_bottom_position: String,
    #[serde(rename = "copyButtonStyle")]
    pub copy_button_style: String,
    #[serde(rename = "copyButtonCustomText")]
    pub copy_button_custom_text: String,
}

impl Default for ManagerFeatureConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            mermaid: false,
            math: false,
            copy_button: true,
            max_width_enabled: false,
            max_width_ratio: 75.0,
            font_size_enabled: false,
            font_size: 16.0,
            copy_button_smart_hover: false,
            copy_button_bottom_position: "float".to_string(),
            copy_button_style: "arrow".to_string(),
            copy_button_custom_text: "".to_string(),
        }
    }
}

/// 安装补丁
#[tauri::command]
pub fn install_patch(
    path: String, 
    features: FeatureConfig,
    manager_features: ManagerFeatureConfig
) -> Result<(), String> {
    let antigravity_root = resolve_antigravity_root(&path)?;
    let resources_root = paths::resources_app_root(&antigravity_root);

    if should_use_privileged(&resources_root) {
        return run_privileged_patch(
            PatchMode::Install,
            &resources_root,
            Some(&features),
            Some(&manager_features),
        );
    }

    match install_patch_internal(&resources_root, &features, &manager_features) {
        Ok(()) => Ok(()),
        Err(err) if is_permission_error(&err) => run_privileged_patch(
            PatchMode::Install,
            &resources_root,
            Some(&features),
            Some(&manager_features),
        ),
        Err(err) => Err(err),
    }
}

fn install_patch_internal(
    resources_root: &PathBuf,
    features: &FeatureConfig,
    manager_features: &ManagerFeatureConfig,
) -> Result<(), String> {
    // 侧边栏目标目录
    let extensions_dir = resources_root
        .join("extensions")
        .join("antigravity");

    // Manager 目标目录
    let workbench_dir = resources_root
        .join("out")
        .join("vs")
        .join("code")
        .join("electron-browser")
        .join("workbench");

    if !extensions_dir.exists() {
        return Err("无效的 Antigravity 安装目录".to_string());
    }

    if !workbench_dir.exists() {
        return Err("Manager 窗口目录不存在".to_string());
    }

    if let Some(dir) = first_unwritable_dir(&[&extensions_dir, &workbench_dir, resources_root])? {
        return handle_privileged_or_error(
            PatchMode::Install,
            resources_root,
            Some(features),
            Some(manager_features),
            &dir,
        );
    }

    // 根据 enabled 状态处理侧边栏补丁
    if features.enabled {
        // 备份并安装侧边栏补丁
        backup_cascade_files(&extensions_dir)?;
        write_cascade_patches(&extensions_dir, features)?;
    } else {
        // 禁用时还原侧边栏文件
        restore_cascade_files(&extensions_dir)?;
    }

    // 根据 enabled 状态处理 Manager 补丁
    if manager_features.enabled {
        // 备份并安装 Manager 补丁
        backup_manager_files(&workbench_dir)?;
        write_manager_patches(&workbench_dir, manager_features)?;
        
        // 清理 product.json 中的 checksums (防止 Antigravity 报"已损坏")
        let product_json_path = resources_root.join("product.json");
        clean_checksums(&product_json_path)?;
    } else {
        // 禁用时还原 Manager 文件
        restore_manager_files(&workbench_dir)?;
    }

    Ok(())
}

/// 卸载补丁 (恢复原版)
#[tauri::command]
pub fn uninstall_patch(path: String) -> Result<(), String> {
    let antigravity_root = resolve_antigravity_root(&path)?;
    let resources_root = paths::resources_app_root(&antigravity_root);

    if should_use_privileged(&resources_root) {
        return run_privileged_patch(PatchMode::Uninstall, &resources_root, None, None);
    }

    match uninstall_patch_internal(&resources_root) {
        Ok(()) => Ok(()),
        Err(err) if is_permission_error(&err) => {
            run_privileged_patch(PatchMode::Uninstall, &resources_root, None, None)
        }
        Err(err) => Err(err),
    }
}

fn uninstall_patch_internal(resources_root: &PathBuf) -> Result<(), String> {
    let extensions_dir = resources_root
        .join("extensions")
        .join("antigravity");

    let workbench_dir = resources_root
        .join("out")
        .join("vs")
        .join("code")
        .join("electron-browser")
        .join("workbench");

    if !extensions_dir.exists() {
        return Err("无效的 Antigravity 安装目录".to_string());
    }

    if let Some(dir) = first_unwritable_dir(&[&extensions_dir, &workbench_dir])? {
        return handle_privileged_or_error(PatchMode::Uninstall, resources_root, None, None, &dir);
    }

    // 恢复备份文件
    restore_backup_files(&extensions_dir, &workbench_dir)?;

    Ok(())
}

/// 仅更新配置文件 (不重新复制补丁文件)
#[tauri::command]
pub fn update_config(
    path: String, 
    features: FeatureConfig,
    manager_features: ManagerFeatureConfig
) -> Result<(), String> {
    let antigravity_root = resolve_antigravity_root(&path)?;
    let resources_root = paths::resources_app_root(&antigravity_root);

    if should_use_privileged(&resources_root) {
        return run_privileged_patch(
            PatchMode::UpdateConfig,
            &resources_root,
            Some(&features),
            Some(&manager_features),
        );
    }

    match update_config_internal(&resources_root, &features, &manager_features) {
        Ok(()) => Ok(()),
        Err(err) if is_permission_error(&err) => run_privileged_patch(
            PatchMode::UpdateConfig,
            &resources_root,
            Some(&features),
            Some(&manager_features),
        ),
        Err(err) => Err(err),
    }
}

fn update_config_internal(
    resources_root: &PathBuf,
    features: &FeatureConfig,
    manager_features: &ManagerFeatureConfig,
) -> Result<(), String> {
    // 侧边栏配置
    let cascade_config_path = resources_root
        .join("extensions")
        .join("antigravity")
        .join("cascade-panel")
        .join("config.json");

    if !cascade_config_path.parent().map(|p| p.exists()).unwrap_or(false) {
        return Err("补丁尚未安装，请先安装补丁".to_string());
    }

    let mut writable_checks = Vec::new();
    if let Some(parent) = cascade_config_path.parent() {
        if parent.exists() {
            writable_checks.push(parent.to_path_buf());
        }
    }

    // Manager 配置
    let manager_config_path = resources_root
        .join("out")
        .join("vs")
        .join("code")
        .join("electron-browser")
        .join("workbench")
        .join("manager-panel")
        .join("config.json");

    if manager_config_path.parent().map(|p| p.exists()).unwrap_or(false) {
        if let Some(parent) = manager_config_path.parent() {
            writable_checks.push(parent.to_path_buf());
        }
    }

    if !writable_checks.is_empty() {
        let refs: Vec<&PathBuf> = writable_checks.iter().collect();
        if let Some(dir) = first_unwritable_dir(&refs)? {
            return handle_privileged_or_error(
                PatchMode::UpdateConfig,
                resources_root,
                Some(features),
                Some(manager_features),
                &dir,
            );
        }
    }

    write_config_file(&cascade_config_path, features)?;

    if manager_config_path.parent().map(|p| p.exists()).unwrap_or(false) {
        write_manager_config_file(&manager_config_path, manager_features)?;
    }

    Ok(())
}

/// 检测补丁是否已安装
#[tauri::command]
pub fn check_patch_status(path: String) -> Result<bool, String> {
    let antigravity_root = resolve_antigravity_root(&path)?;
    let resources_root = paths::resources_app_root(&antigravity_root);
    
    let config_path = resources_root
        .join("extensions")
        .join("antigravity")
        .join("cascade-panel")
        .join("config.json");

    // 如果 config.json 存在, 则认为补丁已安装
    Ok(config_path.exists())
}

/// 读取已安装的补丁配置
#[tauri::command]
pub fn read_patch_config(path: String) -> Result<Option<FeatureConfig>, String> {
    let antigravity_root = resolve_antigravity_root(&path)?;
    let resources_root = paths::resources_app_root(&antigravity_root);
    
    let config_path = resources_root
        .join("extensions")
        .join("antigravity")
        .join("cascade-panel")
        .join("config.json");

    if !config_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("读取配置失败: {}", e))?;
    
    let config: FeatureConfig = serde_json::from_str(&content)
        .map_err(|e| format!("解析配置失败: {}", e))?;
    
    Ok(Some(config))
}

/// 读取已安装的 Manager 补丁配置
#[tauri::command]
pub fn read_manager_patch_config(path: String) -> Result<Option<ManagerFeatureConfig>, String> {
    let antigravity_root = resolve_antigravity_root(&path)?;
    let resources_root = paths::resources_app_root(&antigravity_root);
    
    let config_path = resources_root
        .join("out")
        .join("vs")
        .join("code")
        .join("electron-browser")
        .join("workbench")
        .join("manager-panel")
        .join("config.json");

    if !config_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("读取 Manager 配置失败: {}", e))?;
    
    let config: ManagerFeatureConfig = serde_json::from_str(&content)
        .map_err(|e| format!("解析 Manager 配置失败: {}", e))?;
    
    Ok(Some(config))
}

/// 备份侧边栏相关文件
fn backup_cascade_files(extensions_dir: &PathBuf) -> Result<(), String> {
    let cascade_panel = extensions_dir.join("cascade-panel.html");
    let cascade_backup = extensions_dir.join("cascade-panel.html.bak");
    if cascade_panel.exists() && !cascade_backup.exists() {
        fs::copy(&cascade_panel, &cascade_backup)
            .map_err(|e| format!("备份 cascade-panel.html 失败: {}", e))?;
    }
    Ok(())
}

/// 备份 Manager 相关文件
fn backup_manager_files(workbench_dir: &PathBuf) -> Result<(), String> {
    let jetski_agent = workbench_dir.join("workbench-jetski-agent.html");
    let jetski_backup = workbench_dir.join("workbench-jetski-agent.html.bak");
    if jetski_agent.exists() && !jetski_backup.exists() {
        fs::copy(&jetski_agent, &jetski_backup)
            .map_err(|e| format!("备份 workbench-jetski-agent.html 失败: {}", e))?;
    }
    Ok(())
}

/// 写入侧边栏补丁文件
fn write_cascade_patches(extensions_dir: &PathBuf, features: &FeatureConfig) -> Result<(), String> {
    let cascade_panel_dir = extensions_dir.join("cascade-panel");
    
    // 先删除旧目录, 确保文件结构干净
    if cascade_panel_dir.exists() {
        fs::remove_dir_all(&cascade_panel_dir)
            .map_err(|e| format!("删除旧 cascade-panel 目录失败: {}", e))?;
    }
    
    // 创建目录
    fs::create_dir_all(&cascade_panel_dir)
        .map_err(|e| format!("创建 cascade-panel 目录失败: {}", e))?;
    
    // 写入侧边栏相关补丁文件
    let patch_files = embedded::get_all_files_runtime()?;
    for (relative_path, content) in patch_files {
        // 只处理侧边栏相关文件
        if relative_path != "cascade-panel.html" && !relative_path.starts_with("cascade-panel/") {
            continue;
        }
        
        let full_path = extensions_dir.join(&relative_path);
        
        // 确保父目录存在
        if let Some(parent) = full_path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("创建目录失败: {}", e))?;
            }
        }
        
        fs::write(&full_path, content)
            .map_err(|e| format!("写入文件失败 {:?}: {}", full_path, e))?;
    }
    
    // 生成侧边栏配置文件
    let cascade_config_path = cascade_panel_dir.join("config.json");
    write_config_file(&cascade_config_path, features)?;

    Ok(())
}

/// 写入 Manager 补丁文件
fn write_manager_patches(workbench_dir: &PathBuf, manager_features: &ManagerFeatureConfig) -> Result<(), String> {
    let manager_panel_dir = workbench_dir.join("manager-panel");
    
    // 先删除旧目录, 确保文件结构干净
    if manager_panel_dir.exists() {
        fs::remove_dir_all(&manager_panel_dir)
            .map_err(|e| format!("删除旧 manager-panel 目录失败: {}", e))?;
    }
    
    // 创建目录
    fs::create_dir_all(&manager_panel_dir)
        .map_err(|e| format!("创建 manager-panel 目录失败: {}", e))?;
    
    // 写入 Manager 相关补丁文件
    let patch_files = embedded::get_all_files_runtime()?;
    for (relative_path, content) in patch_files {
        // 只处理 Manager 相关文件
        if relative_path != "workbench-jetski-agent.html" && !relative_path.starts_with("manager-panel/") {
            continue;
        }
        
        let full_path = workbench_dir.join(&relative_path);
        
        // 确保父目录存在
        if let Some(parent) = full_path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("创建目录失败: {}", e))?;
            }
        }
        
        fs::write(&full_path, content)
            .map_err(|e| format!("写入文件失败 {:?}: {}", full_path, e))?;
    }
    
    // 生成 Manager 配置文件
    let manager_config_path = manager_panel_dir.join("config.json");
    write_manager_config_file(&manager_config_path, manager_features)?;

    Ok(())
}

/// 写入侧边栏配置文件
fn write_config_file(config_path: &PathBuf, features: &FeatureConfig) -> Result<(), String> {
    let config_content = serde_json::json!({
        "mermaid": features.mermaid,
        "math": features.math,
        "copyButton": features.copy_button,
        "tableColor": features.table_color,
        "fontSizeEnabled": features.font_size_enabled,
        "fontSize": features.font_size,
        "copyButtonSmartHover": features.copy_button_smart_hover,
        "copyButtonShowBottom": features.copy_button_bottom_position,
        "copyButtonStyle": features.copy_button_style,
        "copyButtonCustomText": features.copy_button_custom_text
    });
    
    fs::write(config_path, serde_json::to_string_pretty(&config_content).unwrap())
        .map_err(|e| format!("写入配置文件失败: {}", e))?;
    
    Ok(())
}

/// 写入 Manager 配置文件
fn write_manager_config_file(config_path: &PathBuf, features: &ManagerFeatureConfig) -> Result<(), String> {
    let config_content = serde_json::json!({
        "mermaid": features.mermaid,
        "math": features.math,
        "copyButton": features.copy_button,
        "maxWidthEnabled": features.max_width_enabled,
        "maxWidthRatio": features.max_width_ratio,
        "fontSizeEnabled": features.font_size_enabled,
        "fontSize": features.font_size,
        "copyButtonSmartHover": features.copy_button_smart_hover,
        "copyButtonShowBottom": features.copy_button_bottom_position,
        "copyButtonStyle": features.copy_button_style,
        "copyButtonCustomText": features.copy_button_custom_text
    });
    
    fs::write(config_path, serde_json::to_string_pretty(&config_content).unwrap())
        .map_err(|e| format!("写入 Manager 配置文件失败: {}", e))?;
    
    Ok(())
}

/// 恢复侧边栏文件 (禁用补丁时调用)
fn restore_cascade_files(extensions_dir: &PathBuf) -> Result<(), String> {
    // 恢复 cascade-panel.html
    let cascade_panel = extensions_dir.join("cascade-panel.html");
    let cascade_backup = extensions_dir.join("cascade-panel.html.bak");
    if cascade_backup.exists() {
        fs::copy(&cascade_backup, &cascade_panel)
            .map_err(|e| format!("恢复 cascade-panel.html 失败: {}", e))?;
    }

    // 删除侧边栏补丁目录
    let cascade_dir = extensions_dir.join("cascade-panel");
    if cascade_dir.exists() {
        fs::remove_dir_all(&cascade_dir)
            .map_err(|e| format!("删除 cascade-panel 目录失败: {}", e))?;
    }

    Ok(())
}

/// 恢复 Manager 文件 (禁用补丁时调用)
fn restore_manager_files(workbench_dir: &PathBuf) -> Result<(), String> {
    // 恢复 workbench-jetski-agent.html
    let jetski_agent = workbench_dir.join("workbench-jetski-agent.html");
    let jetski_backup = workbench_dir.join("workbench-jetski-agent.html.bak");
    if jetski_backup.exists() {
        fs::copy(&jetski_backup, &jetski_agent)
            .map_err(|e| format!("恢复 workbench-jetski-agent.html 失败: {}", e))?;
    }

    // 删除 Manager 补丁目录
    let manager_dir = workbench_dir.join("manager-panel");
    if manager_dir.exists() {
        fs::remove_dir_all(&manager_dir)
            .map_err(|e| format!("删除 manager-panel 目录失败: {}", e))?;
    }

    Ok(())
}

/// 恢复所有备份文件 (完全卸载时调用)
fn restore_backup_files(extensions_dir: &PathBuf, workbench_dir: &PathBuf) -> Result<(), String> {
    restore_cascade_files(extensions_dir)?;
    restore_manager_files(workbench_dir)?;
    Ok(())
}

/// 清理 product.json 中的指定 checksums 条目
/// 补丁修改了某些文件后，如果不移除对应的校验和，Antigravity 会报"已损坏"
fn clean_checksums(product_json_path: &PathBuf) -> Result<(), String> {
    if !product_json_path.exists() {
        // product.json 不存在，跳过
        return Ok(());
    }

    // 读取 product.json
    let content = fs::read_to_string(product_json_path)
        .map_err(|e| format!("读取 product.json 失败: {}", e))?;
    
    let mut json: Value = serde_json::from_str(&content)
        .map_err(|e| format!("解析 product.json 失败: {}", e))?;

    // 获取 checksums 对象
    if let Some(checksums) = json.get_mut("checksums") {
        if let Some(checksums_obj) = checksums.as_object_mut() {
            let mut removed_count = 0;
            
            // 移除指定的条目
            for key in CHECKSUMS_TO_REMOVE {
                if checksums_obj.remove(*key).is_some() {
                    removed_count += 1;
                }
            }
            
            // 只有实际移除了条目才写回文件
            if removed_count > 0 {
                let new_content = serde_json::to_string_pretty(&json)
                    .map_err(|e| format!("序列化 product.json 失败: {}", e))?;
                
                fs::write(product_json_path, new_content)
                    .map_err(|e| format!("写入 product.json 失败: {}", e))?;
            }
        }
    }

    Ok(())
}

fn resolve_antigravity_root(path: &str) -> Result<PathBuf, String> {
    let input = PathBuf::from(path);
    paths::normalize_antigravity_root(&input)
        .ok_or_else(|| "无效的 Antigravity 安装目录".to_string())
}

fn is_permission_error(message: &str) -> bool {
    let lower = message.to_ascii_lowercase();
    message.contains("权限不足")
        || lower.contains("permission denied")
        || lower.contains("operation not permitted")
        || lower.contains("read-only file system")
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn should_use_privileged(resources_root: &PathBuf) -> bool {
    let path = resources_root.to_string_lossy();
    let prefixes = [
        "/Applications/",
        "/System/Applications/",
        "/Library/",
        "/System/",
        "/usr/",
        "/opt/",
        "/lib/",
        "/lib64/",
        "/var/",
        "/snap/",
    ];

    prefixes.iter().any(|prefix| path.starts_with(prefix))
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
fn should_use_privileged(_resources_root: &PathBuf) -> bool {
    false
}

fn first_unwritable_dir(dirs: &[&PathBuf]) -> Result<Option<PathBuf>, String> {
    for dir in dirs {
        match can_write_dir(dir)? {
            true => {}
            false => return Ok(Some((*dir).clone())),
        }
    }
    Ok(None)
}

fn can_write_dir(dir: &PathBuf) -> Result<bool, String> {
    let test_path = dir.join(".anti-power-write-test");
    match fs::OpenOptions::new()
        .create(true)
        .write(true)
        .open(&test_path)
    {
        Ok(_) => {
            let _ = fs::remove_file(&test_path);
            Ok(true)
        }
        Err(err) => match err.kind() {
            ErrorKind::PermissionDenied | ErrorKind::ReadOnlyFilesystem => Ok(false),
            _ => Err(format!("无法写入目录 {}: {}", dir.display(), err)),
        },
    }
}

fn handle_privileged_or_error(
    mode: PatchMode,
    resources_root: &PathBuf,
    features: Option<&FeatureConfig>,
    manager_features: Option<&ManagerFeatureConfig>,
    dir: &PathBuf,
) -> Result<(), String> {
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        let _ = dir;
        return run_privileged_patch(mode, resources_root, features, manager_features);
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        Err(format!(
            "权限不足：无法写入目录 {}。请以管理员身份运行或将应用安装到可写位置。",
            dir.display()
        ))
    }
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn run_privileged_patch(
    mode: PatchMode,
    resources_root: &PathBuf,
    features: Option<&FeatureConfig>,
    manager_features: Option<&ManagerFeatureConfig>,
) -> Result<(), String> {
    let temp_dir = prepare_temp_patch_dir()?;
    write_embedded_files_to_dir(&temp_dir)?;

    if matches!(mode, PatchMode::Install | PatchMode::UpdateConfig) {
        let feature_config = features.ok_or_else(|| "缺少侧边栏配置".to_string())?;
        let manager_config = manager_features.ok_or_else(|| "缺少 Manager 配置".to_string())?;

        let cascade_config_path = temp_dir.join("cascade-panel").join("config.json");
        write_config_file(&cascade_config_path, feature_config)?;

        let manager_config_path = temp_dir.join("manager-panel").join("config.json");
        write_manager_config_file(&manager_config_path, manager_config)?;
    }

    let script_path = temp_dir.join("anti-power.sh");
    if !script_path.exists() {
        let _ = fs::remove_dir_all(&temp_dir);
        return Err("未找到 anti-power.sh".to_string());
    }

    ensure_script_executable(&script_path)?;

    let cascade_enabled = features.map(|config| config.enabled).unwrap_or(true);
    let manager_enabled = manager_features.map(|config| config.enabled).unwrap_or(true);
    let args = build_script_args(mode, resources_root, cascade_enabled, manager_enabled);
    let status_path = temp_dir.join("privileged-status.txt");

    match run_privileged_script(&script_path, &args, &status_path) {
        Ok(()) => {
            let _ = fs::remove_dir_all(&temp_dir);
            Ok(())
        }
        Err(err) => {
            let message = annotate_privileged_error(err, resources_root);
            let _ = fs::remove_dir_all(&temp_dir);
            Err(format!("管理员脚本执行失败: {}", message))
        }
    }
}

fn annotate_privileged_error(message: String, resources_root: &PathBuf) -> String {
    #[cfg(target_os = "macos")]
    {
        let lower = message.to_ascii_lowercase();
        if lower.contains("operation not permitted") || message.contains("权限") {
            return format!(
                "{}。macOS 可能拦截了对应用包的修改，请在 系统设置 → 隐私与安全性 → App 管理 为 Anti-Power 授权，必要时再在“完全磁盘访问”中授权；或将 Antigravity.app 移动到 ~/Applications 后重试。资源路径: {}",
                message,
                resources_root.display()
            );
        }
    }

    let _ = resources_root;
    message
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
fn run_privileged_patch(
    _mode: PatchMode,
    _resources_root: &PathBuf,
    _features: Option<&FeatureConfig>,
    _manager_features: Option<&ManagerFeatureConfig>,
) -> Result<(), String> {
    Err("当前平台不支持管理员权限补丁流程，请手动运行补丁脚本".to_string())
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn prepare_temp_patch_dir() -> Result<PathBuf, String> {
    let mut dir = env::temp_dir();
    dir.push(format!("anti-power-privileged-{}", std::process::id()));

    if dir.exists() {
        fs::remove_dir_all(&dir)
            .map_err(|e| format!("清理临时目录失败: {}", e))?;
    }

    fs::create_dir_all(&dir)
        .map_err(|e| format!("创建临时目录失败: {}", e))?;

    Ok(dir)
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn write_embedded_files_to_dir(root: &PathBuf) -> Result<(), String> {
    let patch_files = embedded::get_all_files_runtime()?;
    for (relative_path, content) in patch_files {
        let full_path = root.join(&relative_path);
        if let Some(parent) = full_path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("创建目录失败: {}", e))?;
            }
        }

        fs::write(&full_path, content)
            .map_err(|e| format!("写入文件失败 {:?}: {}", full_path, e))?;
    }

    Ok(())
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn ensure_script_executable(script_path: &PathBuf) -> Result<(), String> {
    #[cfg(unix)]
    {
        let mut perms = fs::metadata(script_path)
            .map_err(|e| format!("读取脚本权限失败: {}", e))?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(script_path, perms)
            .map_err(|e| format!("设置脚本权限失败: {}", e))?;
    }

    Ok(())
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn build_script_args(
    mode: PatchMode,
    resources_root: &PathBuf,
    cascade_enabled: bool,
    manager_enabled: bool,
) -> Vec<String> {
    vec![
        "--mode".to_string(),
        mode.as_str().to_string(),
        "--app-path".to_string(),
        resources_root.to_string_lossy().to_string(),
        "--cascade-enabled".to_string(),
        cascade_enabled.to_string(),
        "--manager-enabled".to_string(),
        manager_enabled.to_string(),
    ]
}

#[cfg(target_os = "macos")]
fn run_privileged_script(
    script_path: &PathBuf,
    args: &[String],
    status_path: &PathBuf,
) -> Result<(), String> {
    let mut command_parts = Vec::new();
    command_parts.push(shell_quote("/bin/bash"));
    command_parts.push(shell_quote(script_path.to_string_lossy().as_ref()));
    for arg in args {
        command_parts.push(shell_quote(arg));
    }

    let command_line = command_parts.join(" ");
    let status_path_quoted = shell_quote(status_path.to_string_lossy().as_ref());
    let terminal_command = format!(
        "sudo {} ; echo $? > {}",
        command_line, status_path_quoted
    );
    let apple_script = format!(
        "tell application \"Terminal\"\nactivate\ndo script \"{}\"\nend tell",
        escape_applescript_string(&terminal_command)
    );

    Command::new("osascript")
        .arg("-e")
        .arg(apple_script)
        .output()
        .map_err(|e| format!("调用 Terminal 失败: {}", e))?;

    wait_for_status(status_path, std::time::Duration::from_secs(900))
}

#[cfg(target_os = "linux")]
fn run_privileged_script(
    script_path: &PathBuf,
    args: &[String],
    _status_path: &PathBuf,
) -> Result<(), String> {
    let output = Command::new("pkexec")
        .arg("/bin/bash")
        .arg(script_path)
        .args(args)
        .output();

    match output {
        Ok(output) if output.status.success() => Ok(()),
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let message = if !stderr.is_empty() {
                stderr
            } else if !stdout.is_empty() {
                stdout
            } else {
                "管理员权限操作被取消或失败".to_string()
            };
            Err(message)
        }
        Err(err) if err.kind() == ErrorKind::NotFound => Err(
            "未找到 pkexec，请安装 polkit 或使用 sudo 从终端运行应用".to_string(),
        ),
        Err(err) => Err(format!("执行 pkexec 失败: {}", err)),
    }
}

#[cfg(target_os = "macos")]
fn shell_quote(value: &str) -> String {
    if value.is_empty() {
        return "''".to_string();
    }

    let mut out = String::from("'");
    for ch in value.chars() {
        if ch == '\'' {
            out.push_str("'\\''");
        } else {
            out.push(ch);
        }
    }
    out.push('\'');
    out
}

#[cfg(target_os = "macos")]
fn escape_applescript_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

#[cfg(target_os = "macos")]
fn wait_for_status(status_path: &PathBuf, timeout: std::time::Duration) -> Result<(), String> {
    let start = std::time::Instant::now();
    while start.elapsed() < timeout {
        if status_path.exists() {
            let content = fs::read_to_string(status_path)
                .map_err(|e| format!("读取状态文件失败: {}", e))?;
            let _ = fs::remove_file(status_path);
            let code = content.trim().parse::<i32>().unwrap_or(1);
            if code == 0 {
                return Ok(());
            }
            return Err(format!("终端命令执行失败，退出码 {}", code));
        }
        std::thread::sleep(std::time::Duration::from_millis(500));
    }

    Err("终端尚未完成，请在 Terminal 中完成授权后重试".to_string())
}
