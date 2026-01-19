// Patch installation and removal

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use crate::embedded;

/// Patch feature toggles
#[derive(Debug, Serialize, Deserialize)]
#[serde(default)]
pub struct FeatureConfig {
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
            mermaid: true,
            math: true,
            copy_button: true,
            table_color: true,
            font_size_enabled: true,
            font_size: 20.0,
        }
    }
}

/// Install patches
#[tauri::command]
pub fn install_patch(path: String, features: FeatureConfig) -> Result<(), String> {
    let antigravity_path = PathBuf::from(&path);
    
    let extensions_dir = antigravity_path
        .join("resources")
        .join("app")
        .join("extensions")
        .join("antigravity");

    if !extensions_dir.exists() {
        return Err("无效的 Antigravity 安装目录".to_string());
    }

    backup_original_files(&extensions_dir)?;

    write_embedded_patches(&extensions_dir, &features)?;

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

    if !extensions_dir.exists() {
        return Err("无效的 Antigravity 安装目录".to_string());
    }

    restore_backup_files(&extensions_dir)?;

    Ok(())
}

/// Update configuration in place without reinstalling patch files
#[tauri::command]
pub fn update_config(path: String, features: FeatureConfig) -> Result<(), String> {
    let antigravity_path = PathBuf::from(&path);
    
    let config_path = antigravity_path
        .join("resources")
        .join("app")
        .join("extensions")
        .join("antigravity")
        .join("cascade-panel")
        .join("config.json");

    if !config_path.parent().map(|p| p.exists()).unwrap_or(false) {
        return Err("补丁尚未安装，请先安装补丁".to_string());
    }

    write_config_file(&config_path, &features)?;

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

/// Back up the original files
fn backup_original_files(extensions_dir: &PathBuf) -> Result<(), String> {
    let cascade_panel = extensions_dir.join("cascade-panel.html");
    let backup_path = extensions_dir.join("cascade-panel.html.bak");

    // Keep the original backup across reinstalls
    if cascade_panel.exists() && !backup_path.exists() {
        fs::copy(&cascade_panel, &backup_path)
            .map_err(|e| format!("备份失败: {}", e))?;
    }

    Ok(())
}

/// Write the embedded patch files
fn write_embedded_patches(extensions_dir: &PathBuf, features: &FeatureConfig) -> Result<(), String> {
    let cascade_panel_dir = extensions_dir.join("cascade-panel");
    
    // Remove the old directory so obsolete patch files cannot linger
    if cascade_panel_dir.exists() {
        fs::remove_dir_all(&cascade_panel_dir)
            .map_err(|e| format!("删除旧补丁目录失败: {}", e))?;
    }
    
    fs::create_dir_all(&cascade_panel_dir)
        .map_err(|e| format!("创建补丁目录失败: {}", e))?;
    
    for (relative_path, content) in embedded::get_all_files() {
        let full_path = extensions_dir.join(relative_path);
        
        if let Some(parent) = full_path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("创建目录失败: {}", e))?;
            }
        }
        
        fs::write(&full_path, content)
            .map_err(|e| format!("写入文件失败 {:?}: {}", full_path, e))?;
    }
    
    let config_path = cascade_panel_dir.join("config.json");
    write_config_file(&config_path, features)?;

    Ok(())
}

/// Write the patch configuration file
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

/// Restore the backed-up files
fn restore_backup_files(extensions_dir: &PathBuf) -> Result<(), String> {
    let cascade_panel = extensions_dir.join("cascade-panel.html");
    let backup_path = extensions_dir.join("cascade-panel.html.bak");

    if backup_path.exists() {
        fs::copy(&backup_path, &cascade_panel)
            .map_err(|e| format!("恢复失败: {}", e))?;
    } else {
        return Err("未找到备份文件".to_string());
    }

    let patch_dir = extensions_dir.join("cascade-panel");
    if patch_dir.exists() {
        fs::remove_dir_all(&patch_dir)
            .map_err(|e| format!("删除补丁目录失败: {}", e))?;
    }

    Ok(())
}
