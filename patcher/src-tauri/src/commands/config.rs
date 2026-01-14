// Installer configuration

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Installer preferences
#[derive(Debug, Serialize, Deserialize, Default)]
pub struct AppConfig {
    /// Antigravity installation path
    #[serde(rename = "antigravityPath")]
    pub antigravity_path: Option<String>,
    
    /// Patch feature toggles
    pub features: FeatureFlags,
}

/// Patch feature toggles
#[derive(Debug, Serialize, Deserialize)]
pub struct FeatureFlags {
    pub mermaid: bool,
    pub math: bool,
    #[serde(rename = "copyButton")]
    pub copy_button: bool,
    #[serde(rename = "tableColor")]
    pub table_color: bool,
}

impl Default for FeatureFlags {
    fn default() -> Self {
        Self {
            mermaid: true,
            math: true,
            copy_button: true,
            table_color: true,
        }
    }
}

/// Resolve the installer configuration path
fn get_config_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("anti-power")
        .join("config.json")
}

/// Load installer preferences
#[tauri::command]
pub fn get_config() -> AppConfig {
    let config_path = get_config_path();
    
    if config_path.exists() {
        if let Ok(content) = fs::read_to_string(&config_path) {
            if let Ok(config) = serde_json::from_str(&content) {
                return config;
            }
        }
    }
    
    AppConfig::default()
}

/// Save installer preferences
#[tauri::command]
pub fn save_config(config: AppConfig) -> Result<(), String> {
    let config_path = get_config_path();
    
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("创建配置目录失败: {}", e))?;
    }
    
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("序列化配置失败: {}", e))?;
    
    fs::write(&config_path, content)
        .map_err(|e| format!("保存配置失败: {}", e))?;
    
    Ok(())
}
