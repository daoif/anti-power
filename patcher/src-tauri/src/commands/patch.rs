// Patch installation and removal

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use crate::embedded;

/// Sidebar feature toggles
#[derive(Debug, Serialize, Deserialize)]
#[serde(default)]
pub struct FeatureConfig {
    /// Enable the sidebar patch or restore the original sidebar files
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
        }
    }
}

/// Manager window feature toggles
#[derive(Debug, Serialize, Deserialize)]
#[serde(default)]
pub struct ManagerFeatureConfig {
    /// Enable the Manager patch or restore the original Manager files
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
        }
    }
}

/// Install patches
#[tauri::command]
pub fn install_patch(
    path: String, 
    features: FeatureConfig,
    manager_features: ManagerFeatureConfig
) -> Result<(), String> {
    let antigravity_path = PathBuf::from(&path);
    
    let extensions_dir = antigravity_path
        .join("resources")
        .join("app")
        .join("extensions")
        .join("antigravity");

    // The Manager entry lives under the workbench directory
    let workbench_dir = antigravity_path
        .join("resources")
        .join("app")
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

    if features.enabled {
        backup_cascade_files(&extensions_dir)?;
        write_cascade_patches(&extensions_dir, &features)?;
    } else {
        restore_cascade_files(&extensions_dir)?;
    }

    if manager_features.enabled {
        backup_manager_files(&workbench_dir)?;
        write_manager_patches(&workbench_dir, &manager_features)?;
    } else {
        restore_manager_files(&workbench_dir)?;
    }

    Ok(())
}

/// Uninstall patches and restore the original files
#[tauri::command]
pub fn uninstall_patch(path: String) -> Result<(), String> {
    let antigravity_path = PathBuf::from(&path);
    
    let extensions_dir = antigravity_path
        .join("resources")
        .join("app")
        .join("extensions")
        .join("antigravity");

    let workbench_dir = antigravity_path
        .join("resources")
        .join("app")
        .join("out")
        .join("vs")
        .join("code")
        .join("electron-browser")
        .join("workbench");

    if !extensions_dir.exists() {
        return Err("无效的 Antigravity 安装目录".to_string());
    }

    restore_backup_files(&extensions_dir, &workbench_dir)?;

    Ok(())
}

/// Update configuration in place without reinstalling patch files
#[tauri::command]
pub fn update_config(
    path: String, 
    features: FeatureConfig,
    manager_features: ManagerFeatureConfig
) -> Result<(), String> {
    let antigravity_path = PathBuf::from(&path);
    
    let cascade_config_path = antigravity_path
        .join("resources")
        .join("app")
        .join("extensions")
        .join("antigravity")
        .join("cascade-panel")
        .join("config.json");

    if !cascade_config_path.parent().map(|p| p.exists()).unwrap_or(false) {
        return Err("补丁尚未安装，请先安装补丁".to_string());
    }

    write_config_file(&cascade_config_path, &features)?;

    let manager_config_path = antigravity_path
        .join("resources")
        .join("app")
        .join("out")
        .join("vs")
        .join("code")
        .join("electron-browser")
        .join("workbench")
        .join("manager-panel")
        .join("config.json");

    if manager_config_path.parent().map(|p| p.exists()).unwrap_or(false) {
        write_manager_config_file(&manager_config_path, &manager_features)?;
    }

    Ok(())
}

/// Check whether a patch is installed
#[tauri::command]
pub fn check_patch_status(path: String) -> Result<bool, String> {
    let antigravity_path = PathBuf::from(&path);
    
    let config_path = antigravity_path
        .join("resources")
        .join("app")
        .join("extensions")
        .join("antigravity")
        .join("cascade-panel")
        .join("config.json");

    // Use config.json as the installation marker
    Ok(config_path.exists())
}

/// Read the installed patch configuration
#[tauri::command]
pub fn read_patch_config(path: String) -> Result<Option<FeatureConfig>, String> {
    let antigravity_path = PathBuf::from(&path);
    
    let config_path = antigravity_path
        .join("resources")
        .join("app")
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

/// Read the installed Manager patch configuration
#[tauri::command]
pub fn read_manager_patch_config(path: String) -> Result<Option<ManagerFeatureConfig>, String> {
    let antigravity_path = PathBuf::from(&path);
    
    let config_path = antigravity_path
        .join("resources")
        .join("app")
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

/// Back up the original sidebar files
fn backup_cascade_files(extensions_dir: &PathBuf) -> Result<(), String> {
    let cascade_panel = extensions_dir.join("cascade-panel.html");
    let cascade_backup = extensions_dir.join("cascade-panel.html.bak");
    if cascade_panel.exists() && !cascade_backup.exists() {
        fs::copy(&cascade_panel, &cascade_backup)
            .map_err(|e| format!("备份 cascade-panel.html 失败: {}", e))?;
    }
    Ok(())
}

/// Back up the original Manager files
fn backup_manager_files(workbench_dir: &PathBuf) -> Result<(), String> {
    let jetski_agent = workbench_dir.join("workbench-jetski-agent.html");
    let jetski_backup = workbench_dir.join("workbench-jetski-agent.html.bak");
    if jetski_agent.exists() && !jetski_backup.exists() {
        fs::copy(&jetski_agent, &jetski_backup)
            .map_err(|e| format!("备份 workbench-jetski-agent.html 失败: {}", e))?;
    }
    Ok(())
}

/// Write the sidebar patch files
fn write_cascade_patches(extensions_dir: &PathBuf, features: &FeatureConfig) -> Result<(), String> {
    let cascade_panel_dir = extensions_dir.join("cascade-panel");
    
    // Remove the old directory so obsolete patch files cannot linger
    if cascade_panel_dir.exists() {
        fs::remove_dir_all(&cascade_panel_dir)
            .map_err(|e| format!("删除旧 cascade-panel 目录失败: {}", e))?;
    }
    
    fs::create_dir_all(&cascade_panel_dir)
        .map_err(|e| format!("创建 cascade-panel 目录失败: {}", e))?;
    
    let patch_files = embedded::get_all_files_runtime()?;
    for (relative_path, content) in patch_files {
        if relative_path != "cascade-panel.html" && !relative_path.starts_with("cascade-panel/") {
            continue;
        }
        
        let full_path = extensions_dir.join(&relative_path);
        
        if let Some(parent) = full_path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("创建目录失败: {}", e))?;
            }
        }
        
        fs::write(&full_path, content)
            .map_err(|e| format!("写入文件失败 {:?}: {}", full_path, e))?;
    }
    
    let cascade_config_path = cascade_panel_dir.join("config.json");
    write_config_file(&cascade_config_path, features)?;

    Ok(())
}

/// Write the Manager patch files
fn write_manager_patches(workbench_dir: &PathBuf, manager_features: &ManagerFeatureConfig) -> Result<(), String> {
    let manager_panel_dir = workbench_dir.join("manager-panel");
    
    // Remove the old directory so obsolete patch files cannot linger
    if manager_panel_dir.exists() {
        fs::remove_dir_all(&manager_panel_dir)
            .map_err(|e| format!("删除旧 manager-panel 目录失败: {}", e))?;
    }
    
    fs::create_dir_all(&manager_panel_dir)
        .map_err(|e| format!("创建 manager-panel 目录失败: {}", e))?;
    
    let patch_files = embedded::get_all_files_runtime()?;
    for (relative_path, content) in patch_files {
        if relative_path != "workbench-jetski-agent.html" && !relative_path.starts_with("manager-panel/") {
            continue;
        }
        
        let full_path = workbench_dir.join(&relative_path);
        
        if let Some(parent) = full_path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("创建目录失败: {}", e))?;
            }
        }
        
        fs::write(&full_path, content)
            .map_err(|e| format!("写入文件失败 {:?}: {}", full_path, e))?;
    }
    
    let manager_config_path = manager_panel_dir.join("config.json");
    write_manager_config_file(&manager_config_path, manager_features)?;

    Ok(())
}

/// Write the sidebar patch configuration
fn write_config_file(config_path: &PathBuf, features: &FeatureConfig) -> Result<(), String> {
    let config_content = serde_json::json!({
        "mermaid": features.mermaid,
        "math": features.math,
        "copyButton": features.copy_button,
        "tableColor": features.table_color,
        "fontSizeEnabled": features.font_size_enabled,
        "fontSize": features.font_size
    });
    
    fs::write(config_path, serde_json::to_string_pretty(&config_content).unwrap())
        .map_err(|e| format!("写入配置文件失败: {}", e))?;
    
    Ok(())
}

/// Write the Manager patch configuration
fn write_manager_config_file(config_path: &PathBuf, features: &ManagerFeatureConfig) -> Result<(), String> {
    let config_content = serde_json::json!({
        "mermaid": features.mermaid,
        "math": features.math,
        "copyButton": features.copy_button,
        "maxWidthEnabled": features.max_width_enabled,
        "maxWidthRatio": features.max_width_ratio,
        "fontSizeEnabled": features.font_size_enabled,
        "fontSize": features.font_size
    });
    
    fs::write(config_path, serde_json::to_string_pretty(&config_content).unwrap())
        .map_err(|e| format!("写入 Manager 配置文件失败: {}", e))?;
    
    Ok(())
}

/// Restore the original sidebar files when the patch is disabled
fn restore_cascade_files(extensions_dir: &PathBuf) -> Result<(), String> {
    let cascade_panel = extensions_dir.join("cascade-panel.html");
    let cascade_backup = extensions_dir.join("cascade-panel.html.bak");
    if cascade_backup.exists() {
        fs::copy(&cascade_backup, &cascade_panel)
            .map_err(|e| format!("恢复 cascade-panel.html 失败: {}", e))?;
    }

    let cascade_dir = extensions_dir.join("cascade-panel");
    if cascade_dir.exists() {
        fs::remove_dir_all(&cascade_dir)
            .map_err(|e| format!("删除 cascade-panel 目录失败: {}", e))?;
    }

    Ok(())
}

/// Restore the original Manager files when the patch is disabled
fn restore_manager_files(workbench_dir: &PathBuf) -> Result<(), String> {
    let jetski_agent = workbench_dir.join("workbench-jetski-agent.html");
    let jetski_backup = workbench_dir.join("workbench-jetski-agent.html.bak");
    if jetski_backup.exists() {
        fs::copy(&jetski_backup, &jetski_agent)
            .map_err(|e| format!("恢复 workbench-jetski-agent.html 失败: {}", e))?;
    }

    let manager_dir = workbench_dir.join("manager-panel");
    if manager_dir.exists() {
        fs::remove_dir_all(&manager_dir)
            .map_err(|e| format!("删除 manager-panel 目录失败: {}", e))?;
    }

    Ok(())
}

/// Restore all backed-up files during a full uninstall
fn restore_backup_files(extensions_dir: &PathBuf, workbench_dir: &PathBuf) -> Result<(), String> {
    restore_cascade_files(extensions_dir)?;
    restore_manager_files(workbench_dir)?;
    Ok(())
}

