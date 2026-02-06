//! 配置管理模块
//!
//! 处理应用配置的读取和保存

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use super::i18n::CommandError;

type ConfigResult<T> = Result<T, CommandError>;

fn config_with(_locale: Option<&str>, key: &'static str, vars: &[(&str, String)]) -> CommandError {
    CommandError::key_with(key, vars)
}

/// 应用配置
#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct AppConfig {
    /// Antigravity 安装路径
    #[serde(rename = "antigravityPath")]
    pub antigravity_path: Option<String>,

    /// 功能开关
    pub features: FeatureFlags,
}

/// 功能开关
#[derive(Debug, Serialize, Deserialize)]
#[serde(default)]
pub struct FeatureFlags {
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

impl Default for FeatureFlags {
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

/// 获取配置文件路径
fn get_config_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("anti-power")
        .join("config.json")
}

/// 读取配置, 失败时回退到默认值
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

/// 保存配置
#[tauri::command]
pub fn save_config(config: AppConfig, locale: Option<String>) -> Result<(), String> {
    let locale_ref = locale.as_deref();
    save_config_internal(config, locale_ref).map_err(|err| err.to_message(locale_ref))
}

fn save_config_internal(config: AppConfig, locale: Option<&str>) -> ConfigResult<()> {
    let config_path = get_config_path();

    // 确保配置目录存在
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            config_with(
                locale,
                "configBackend.errors.createConfigDirFailed",
                &[("detail", e.to_string())],
            )
        })?;
    }

    let content = serde_json::to_string_pretty(&config).map_err(|e| {
        config_with(
            locale,
            "configBackend.errors.serializeConfigFailed",
            &[("detail", e.to_string())],
        )
    })?;

    fs::write(&config_path, content).map_err(|e| {
        config_with(
            locale,
            "configBackend.errors.saveConfigFailed",
            &[("detail", e.to_string())],
        )
    })?;

    Ok(())
}
