//! 补丁安装与卸载模块
//!
//! 处理补丁文件的安装、卸载、配置更新等操作

use super::i18n::{self, CommandError};
use super::paths;
use crate::embedded::{self, EmbeddedError};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

#[cfg(any(target_os = "macos", target_os = "linux"))]
use std::env;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
#[cfg(any(target_os = "macos", target_os = "linux"))]
use std::process::Command;

/// 需要从 product.json checksums 中移除的文件路径
/// (这些文件会被补丁修改，如果不移除校验和，Antigravity 会报"已损坏")
const CHECKSUMS_TO_REMOVE: &[&str] = &[
    "extensions/antigravity/cascade-panel.html",
    "vs/code/electron-browser/workbench/workbench.html",
    "vs/code/electron-browser/workbench/workbench-jetski-agent.html",
    // 未来如果有其他需要清理的，添加到这里
];

/// 侧边栏补丁模式:
/// - Legacy: 小于 1.18.3，沿用 cascade-panel.html 入口
/// - Modern: 大于等于 1.18.3，使用 workbench.html 入口
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SidebarPatchVariant {
    Legacy,
    Modern,
}

/// 简化的语义版本号（仅比较 major/minor/patch）
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
struct IdeVersion {
    major: u32,
    minor: u32,
    patch: u32,
}

impl IdeVersion {
    const MODERN_SIDEBAR_THRESHOLD: Self = Self {
        major: 1,
        minor: 18,
        patch: 3,
    };

    fn parse(raw: &str) -> Option<Self> {
        let mut parts = raw.trim().split('.');

        let major = parse_version_component(parts.next()?)?;
        let minor = parse_version_component(parts.next().unwrap_or("0"))?;
        let patch = parse_version_component(parts.next().unwrap_or("0"))?;

        Some(Self {
            major,
            minor,
            patch,
        })
    }
}

fn parse_version_component(input: &str) -> Option<u32> {
    let digits: String = input.chars().take_while(|ch| ch.is_ascii_digit()).collect();
    if digits.is_empty() {
        return None;
    }
    digits.parse::<u32>().ok()
}

enum PatchMode {
    Install,
    Uninstall,
    UpdateConfig,
}

type PatchResult<T> = Result<T, CommandError>;

impl PatchMode {
    fn as_str(&self) -> &'static str {
        match self {
            PatchMode::Install => "install",
            PatchMode::Uninstall => "uninstall",
            PatchMode::UpdateConfig => "update-config",
        }
    }
}

fn patch_text(_locale: Option<&str>, key: &'static str) -> CommandError {
    CommandError::key(key)
}

fn patch_with(_locale: Option<&str>, key: &'static str, vars: &[(&str, String)]) -> CommandError {
    CommandError::key_with(key, vars)
}

fn map_embedded_error(locale: Option<&str>, err: EmbeddedError) -> CommandError {
    match err {
        EmbeddedError::PatchesDirNotFound => {
            patch_text(locale, "patchBackend.errors.patchesDirNotFound")
        }
        EmbeddedError::ReadPatchFileFailed { path, detail } => patch_with(
            locale,
            "patchBackend.errors.readPatchFileFailed",
            &[("detail", format!("{:?}: {}", path, detail))],
        ),
    }
}

fn read_ide_version(resources_root: &Path) -> Option<IdeVersion> {
    let product_json_path = resources_root.join("product.json");
    let content = fs::read_to_string(product_json_path).ok()?;
    let json: Value = serde_json::from_str(&content).ok()?;
    let raw = json.get("ideVersion")?.as_str()?;
    IdeVersion::parse(raw)
}

fn detect_sidebar_patch_variant(resources_root: &Path) -> SidebarPatchVariant {
    match read_ide_version(resources_root) {
        Some(version) if version >= IdeVersion::MODERN_SIDEBAR_THRESHOLD => {
            SidebarPatchVariant::Modern
        }
        _ => SidebarPatchVariant::Legacy,
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
            font_size: 16.0,
            copy_button_smart_hover: true,
            copy_button_bottom_position: "float".to_string(),
            copy_button_style: "icon".to_string(),
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
            enabled: true,
            mermaid: true,
            math: true,
            copy_button: true,
            max_width_enabled: true,
            max_width_ratio: 75.0,
            font_size_enabled: true,
            font_size: 16.0,
            copy_button_smart_hover: true,
            copy_button_bottom_position: "float".to_string(),
            copy_button_style: "icon".to_string(),
            copy_button_custom_text: "".to_string(),
        }
    }
}

/// 安装补丁
#[tauri::command]
pub fn install_patch(
    path: String,
    features: FeatureConfig,
    manager_features: ManagerFeatureConfig,
    locale: Option<String>,
) -> Result<(), String> {
    let locale_ref = locale.as_deref();
    let antigravity_root =
        resolve_antigravity_root(&path, locale_ref).map_err(|err| err.to_message(locale_ref))?;
    let resources_root = paths::resources_app_root(&antigravity_root);

    let result = if should_use_privileged(&resources_root) {
        run_privileged_patch(
            PatchMode::Install,
            &resources_root,
            Some(&features),
            Some(&manager_features),
            locale_ref,
        )
    } else {
        match install_patch_internal(&resources_root, &features, &manager_features, locale_ref) {
            Ok(()) => Ok(()),
            Err(err) if is_permission_error(&err) => run_privileged_patch(
                PatchMode::Install,
                &resources_root,
                Some(&features),
                Some(&manager_features),
                locale_ref,
            ),
            Err(err) => Err(err),
        }
    };

    result.map_err(|err| err.to_message(locale_ref))
}

fn install_patch_internal(
    resources_root: &Path,
    features: &FeatureConfig,
    manager_features: &ManagerFeatureConfig,
    locale: Option<&str>,
) -> PatchResult<()> {
    // 侧边栏目标目录
    let extensions_dir = resources_root.join("extensions").join("antigravity");

    // Manager 目标目录
    let workbench_dir = resources_root
        .join("out")
        .join("vs")
        .join("code")
        .join("electron-browser")
        .join("workbench");

    if !extensions_dir.exists() {
        return Err(patch_text(locale, "patchBackend.errors.invalidInstallDir"));
    }

    if !workbench_dir.exists() {
        return Err(patch_text(locale, "patchBackend.errors.managerDirMissing"));
    }

    if let Some(dir) =
        first_unwritable_dir(&[&extensions_dir, &workbench_dir, resources_root], locale)?
    {
        return handle_privileged_or_error(
            PatchMode::Install,
            resources_root,
            Some(features),
            Some(manager_features),
            &dir,
            locale,
        );
    }

    let sidebar_variant = detect_sidebar_patch_variant(resources_root);

    // 根据 enabled 状态处理侧边栏补丁
    if features.enabled {
        match sidebar_variant {
            SidebarPatchVariant::Legacy => {
                // 旧版入口：extensions/antigravity/cascade-panel.html
                backup_legacy_sidebar_files(&extensions_dir, locale)?;
                write_legacy_sidebar_patches(&extensions_dir, features, locale)?;

                // 清理新版残留
                restore_modern_sidebar_files(&workbench_dir, locale)?;
            }
            SidebarPatchVariant::Modern => {
                // 新版入口：workbench/workbench.html
                backup_modern_sidebar_files(&workbench_dir, locale)?;
                write_modern_sidebar_patches(&workbench_dir, features, locale)?;

                // 清理旧版残留
                restore_legacy_sidebar_files(&extensions_dir, locale)?;
            }
        }
    } else {
        // 禁用时还原所有侧边栏文件（兼容跨版本升级）
        restore_legacy_sidebar_files(&extensions_dir, locale)?;
        restore_modern_sidebar_files(&workbench_dir, locale)?;
    }

    // 根据 enabled 状态处理 Manager 补丁
    if manager_features.enabled {
        // 备份并安装 Manager 补丁
        backup_manager_files(&workbench_dir, locale)?;
        write_manager_patches(&workbench_dir, manager_features, locale)?;
    } else {
        // 禁用时还原 Manager 文件
        restore_manager_files(&workbench_dir, locale)?;
    }

    // 只要任一补丁开启，就清理 product.json checksums，避免应用校验失败
    if features.enabled || manager_features.enabled {
        let product_json_path = resources_root.join("product.json");
        clean_checksums(&product_json_path, locale)?;
    }

    Ok(())
}

/// 卸载补丁 (恢复原版)
#[tauri::command]
pub fn uninstall_patch(path: String, locale: Option<String>) -> Result<(), String> {
    let locale_ref = locale.as_deref();
    let antigravity_root =
        resolve_antigravity_root(&path, locale_ref).map_err(|err| err.to_message(locale_ref))?;
    let resources_root = paths::resources_app_root(&antigravity_root);

    let result = if should_use_privileged(&resources_root) {
        run_privileged_patch(
            PatchMode::Uninstall,
            &resources_root,
            None,
            None,
            locale_ref,
        )
    } else {
        match uninstall_patch_internal(&resources_root, locale_ref) {
            Ok(()) => Ok(()),
            Err(err) if is_permission_error(&err) => run_privileged_patch(
                PatchMode::Uninstall,
                &resources_root,
                None,
                None,
                locale_ref,
            ),
            Err(err) => Err(err),
        }
    };

    result.map_err(|err| err.to_message(locale_ref))
}

fn uninstall_patch_internal(resources_root: &Path, locale: Option<&str>) -> PatchResult<()> {
    let extensions_dir = resources_root.join("extensions").join("antigravity");

    let workbench_dir = resources_root
        .join("out")
        .join("vs")
        .join("code")
        .join("electron-browser")
        .join("workbench");

    if !extensions_dir.exists() {
        return Err(patch_text(locale, "patchBackend.errors.invalidInstallDir"));
    }

    if let Some(dir) = first_unwritable_dir(&[&extensions_dir, &workbench_dir], locale)? {
        return handle_privileged_or_error(
            PatchMode::Uninstall,
            resources_root,
            None,
            None,
            &dir,
            locale,
        );
    }

    // 恢复备份文件
    restore_backup_files(&extensions_dir, &workbench_dir, locale)?;

    Ok(())
}

/// 仅更新配置文件 (不重新复制补丁文件)
#[tauri::command]
pub fn update_config(
    path: String,
    features: FeatureConfig,
    manager_features: ManagerFeatureConfig,
    locale: Option<String>,
) -> Result<(), String> {
    let locale_ref = locale.as_deref();
    let antigravity_root =
        resolve_antigravity_root(&path, locale_ref).map_err(|err| err.to_message(locale_ref))?;
    let resources_root = paths::resources_app_root(&antigravity_root);

    let result = if should_use_privileged(&resources_root) {
        run_privileged_patch(
            PatchMode::UpdateConfig,
            &resources_root,
            Some(&features),
            Some(&manager_features),
            locale_ref,
        )
    } else {
        match update_config_internal(&resources_root, &features, &manager_features, locale_ref) {
            Ok(()) => Ok(()),
            Err(err) if is_permission_error(&err) => run_privileged_patch(
                PatchMode::UpdateConfig,
                &resources_root,
                Some(&features),
                Some(&manager_features),
                locale_ref,
            ),
            Err(err) => Err(err),
        }
    };

    result.map_err(|err| err.to_message(locale_ref))
}

fn update_config_internal(
    resources_root: &Path,
    features: &FeatureConfig,
    manager_features: &ManagerFeatureConfig,
    locale: Option<&str>,
) -> PatchResult<()> {
    // 侧边栏配置（旧版）
    let legacy_sidebar_config_path = resources_root
        .join("extensions")
        .join("antigravity")
        .join("cascade-panel")
        .join("config.json");

    // 侧边栏配置（新版）
    let modern_sidebar_config_path = resources_root
        .join("out")
        .join("vs")
        .join("code")
        .join("electron-browser")
        .join("workbench")
        .join("sidebar-panel")
        .join("config.json");

    let has_legacy_sidebar = legacy_sidebar_config_path
        .parent()
        .map(|p| p.exists())
        .unwrap_or(false);
    let has_modern_sidebar = modern_sidebar_config_path
        .parent()
        .map(|p| p.exists())
        .unwrap_or(false);

    // Manager 配置
    let manager_config_path = resources_root
        .join("out")
        .join("vs")
        .join("code")
        .join("electron-browser")
        .join("workbench")
        .join("manager-panel")
        .join("config.json");

    let has_manager = manager_config_path
        .parent()
        .map(|p| p.exists())
        .unwrap_or(false);

    if !has_legacy_sidebar && !has_modern_sidebar && !has_manager {
        return Err(patch_text(locale, "patchBackend.errors.patchNotInstalled"));
    }

    let mut writable_checks = Vec::new();
    if has_legacy_sidebar {
        if let Some(parent) = legacy_sidebar_config_path.parent() {
            writable_checks.push(parent.to_path_buf());
        }
    }
    if has_modern_sidebar {
        if let Some(parent) = modern_sidebar_config_path.parent() {
            writable_checks.push(parent.to_path_buf());
        }
    }
    if has_manager {
        if let Some(parent) = manager_config_path.parent() {
            writable_checks.push(parent.to_path_buf());
        }
    }

    if !writable_checks.is_empty() {
        let refs: Vec<&Path> = writable_checks.iter().map(|p| p.as_path()).collect();
        if let Some(dir) = first_unwritable_dir(&refs, locale)? {
            return handle_privileged_or_error(
                PatchMode::UpdateConfig,
                resources_root,
                Some(features),
                Some(manager_features),
                &dir,
                locale,
            );
        }
    }

    if has_legacy_sidebar {
        write_config_file(&legacy_sidebar_config_path, features, locale)?;
    }
    if has_modern_sidebar {
        write_config_file(&modern_sidebar_config_path, features, locale)?;
    }

    if has_manager {
        write_manager_config_file(&manager_config_path, manager_features, locale)?;
    }

    Ok(())
}

/// 检测补丁是否已安装
#[tauri::command]
pub fn check_patch_status(path: String, locale: Option<String>) -> Result<bool, String> {
    let locale_ref = locale.as_deref();
    let antigravity_root =
        resolve_antigravity_root(&path, locale_ref).map_err(|err| err.to_message(locale_ref))?;
    let resources_root = paths::resources_app_root(&antigravity_root);

    let legacy_config_path = resources_root
        .join("extensions")
        .join("antigravity")
        .join("cascade-panel")
        .join("config.json");

    let modern_config_path = resources_root
        .join("out")
        .join("vs")
        .join("code")
        .join("electron-browser")
        .join("workbench")
        .join("sidebar-panel")
        .join("config.json");

    let manager_config_path = resources_root
        .join("out")
        .join("vs")
        .join("code")
        .join("electron-browser")
        .join("workbench")
        .join("manager-panel")
        .join("config.json");

    // 任一补丁配置存在即认为已安装（支持仅安装 manager 的场景）
    Ok(legacy_config_path.exists() || modern_config_path.exists() || manager_config_path.exists())
}

/// 读取已安装的补丁配置
#[tauri::command]
pub fn read_patch_config(
    path: String,
    locale: Option<String>,
) -> Result<Option<FeatureConfig>, String> {
    let locale_ref = locale.as_deref();
    let antigravity_root =
        resolve_antigravity_root(&path, locale_ref).map_err(|err| err.to_message(locale_ref))?;
    let resources_root = paths::resources_app_root(&antigravity_root);

    let legacy_config_path = resources_root
        .join("extensions")
        .join("antigravity")
        .join("cascade-panel")
        .join("config.json");

    let modern_config_path = resources_root
        .join("out")
        .join("vs")
        .join("code")
        .join("electron-browser")
        .join("workbench")
        .join("sidebar-panel")
        .join("config.json");

    let config_path = if legacy_config_path.exists() {
        legacy_config_path
    } else if modern_config_path.exists() {
        modern_config_path
    } else {
        return Ok(None);
    };

    let content = fs::read_to_string(&config_path)
        .map_err(|e| {
            patch_with(
                locale_ref,
                "patchBackend.errors.readConfigFailed",
                &[("detail", e.to_string())],
            )
        })
        .map_err(|err| err.to_message(locale_ref))?;

    let config: FeatureConfig = serde_json::from_str(&content)
        .map_err(|e| {
            patch_with(
                locale_ref,
                "patchBackend.errors.parseConfigFailed",
                &[("detail", e.to_string())],
            )
        })
        .map_err(|err| err.to_message(locale_ref))?;

    Ok(Some(config))
}

/// 读取已安装的 Manager 补丁配置
#[tauri::command]
pub fn read_manager_patch_config(
    path: String,
    locale: Option<String>,
) -> Result<Option<ManagerFeatureConfig>, String> {
    let locale_ref = locale.as_deref();
    let antigravity_root =
        resolve_antigravity_root(&path, locale_ref).map_err(|err| err.to_message(locale_ref))?;
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
        .map_err(|e| {
            patch_with(
                locale_ref,
                "patchBackend.errors.readManagerConfigFailed",
                &[("detail", e.to_string())],
            )
        })
        .map_err(|err| err.to_message(locale_ref))?;

    let config: ManagerFeatureConfig = serde_json::from_str(&content)
        .map_err(|e| {
            patch_with(
                locale_ref,
                "patchBackend.errors.parseManagerConfigFailed",
                &[("detail", e.to_string())],
            )
        })
        .map_err(|err| err.to_message(locale_ref))?;

    Ok(Some(config))
}

/// 备份旧版侧边栏相关文件
fn backup_legacy_sidebar_files(extensions_dir: &Path, locale: Option<&str>) -> PatchResult<()> {
    let cascade_panel = extensions_dir.join("cascade-panel.html");
    let cascade_backup = extensions_dir.join("cascade-panel.html.bak");
    if cascade_panel.exists() && !cascade_backup.exists() {
        fs::copy(&cascade_panel, &cascade_backup).map_err(|e| {
            patch_with(
                locale,
                "patchBackend.errors.backupCascadeFailed",
                &[("detail", e.to_string())],
            )
        })?;
    }
    Ok(())
}

/// 备份新版侧边栏相关文件
fn backup_modern_sidebar_files(workbench_dir: &Path, locale: Option<&str>) -> PatchResult<()> {
    let workbench = workbench_dir.join("workbench.html");
    let workbench_backup = workbench_dir.join("workbench.html.bak");
    if workbench.exists() && !workbench_backup.exists() {
        fs::copy(&workbench, &workbench_backup).map_err(|e| {
            patch_with(
                locale,
                "patchBackend.errors.backupCascadeFailed",
                &[("detail", e.to_string())],
            )
        })?;
    }
    Ok(())
}

/// 备份 Manager 相关文件
fn backup_manager_files(workbench_dir: &Path, locale: Option<&str>) -> PatchResult<()> {
    let jetski_agent = workbench_dir.join("workbench-jetski-agent.html");
    let jetski_backup = workbench_dir.join("workbench-jetski-agent.html.bak");
    if jetski_agent.exists() && !jetski_backup.exists() {
        fs::copy(&jetski_agent, &jetski_backup).map_err(|e| {
            patch_with(
                locale,
                "patchBackend.errors.backupManagerEntryFailed",
                &[("detail", e.to_string())],
            )
        })?;
    }
    Ok(())
}

/// 写入旧版侧边栏补丁文件
fn write_legacy_sidebar_patches(
    extensions_dir: &Path,
    features: &FeatureConfig,
    locale: Option<&str>,
) -> PatchResult<()> {
    let cascade_panel_dir = extensions_dir.join("cascade-panel");

    // 先删除旧目录, 确保文件结构干净
    if cascade_panel_dir.exists() {
        fs::remove_dir_all(&cascade_panel_dir).map_err(|e| {
            patch_with(
                locale,
                "patchBackend.errors.removeOldCascadeDirFailed",
                &[("detail", e.to_string())],
            )
        })?;
    }

    // 创建目录
    fs::create_dir_all(&cascade_panel_dir).map_err(|e| {
        patch_with(
            locale,
            "patchBackend.errors.createCascadeDirFailed",
            &[("detail", e.to_string())],
        )
    })?;

    // 写入侧边栏相关补丁文件
    let patch_files =
        embedded::get_all_files_runtime().map_err(|e| map_embedded_error(locale, e))?;
    for (relative_path, content) in patch_files {
        // 只处理侧边栏相关文件
        if relative_path != "cascade-panel.html" && !relative_path.starts_with("cascade-panel/") {
            continue;
        }

        let full_path = extensions_dir.join(&relative_path);

        // 确保父目录存在
        if let Some(parent) = full_path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent).map_err(|e| {
                    patch_with(
                        locale,
                        "patchBackend.errors.createDirFailed",
                        &[("detail", e.to_string())],
                    )
                })?;
            }
        }

        fs::write(&full_path, content).map_err(|e| {
            patch_with(
                locale,
                "patchBackend.errors.writeFileFailed",
                &[("detail", format!("{:?}: {}", full_path, e))],
            )
        })?;
    }

    // 生成侧边栏配置文件
    let cascade_config_path = cascade_panel_dir.join("config.json");
    write_config_file(&cascade_config_path, features, locale)?;

    Ok(())
}

/// 写入新版侧边栏补丁文件
fn write_modern_sidebar_patches(
    workbench_dir: &Path,
    features: &FeatureConfig,
    locale: Option<&str>,
) -> PatchResult<()> {
    let sidebar_panel_dir = workbench_dir.join("sidebar-panel");

    // 先删除旧目录, 确保文件结构干净
    if sidebar_panel_dir.exists() {
        fs::remove_dir_all(&sidebar_panel_dir).map_err(|e| {
            patch_with(
                locale,
                "patchBackend.errors.removeOldCascadeDirFailed",
                &[("detail", e.to_string())],
            )
        })?;
    }

    // 创建目录
    fs::create_dir_all(&sidebar_panel_dir).map_err(|e| {
        patch_with(
            locale,
            "patchBackend.errors.createCascadeDirFailed",
            &[("detail", e.to_string())],
        )
    })?;

    // 写入新版侧边栏相关补丁文件
    let patch_files =
        embedded::get_all_files_runtime().map_err(|e| map_embedded_error(locale, e))?;
    for (relative_path, content) in patch_files {
        if relative_path != "workbench.html" && !relative_path.starts_with("sidebar-panel/") {
            continue;
        }

        let full_path = workbench_dir.join(&relative_path);

        if let Some(parent) = full_path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent).map_err(|e| {
                    patch_with(
                        locale,
                        "patchBackend.errors.createDirFailed",
                        &[("detail", e.to_string())],
                    )
                })?;
            }
        }

        fs::write(&full_path, content).map_err(|e| {
            patch_with(
                locale,
                "patchBackend.errors.writeFileFailed",
                &[("detail", format!("{:?}: {}", full_path, e))],
            )
        })?;
    }

    // 生成新版侧边栏配置文件
    let sidebar_config_path = sidebar_panel_dir.join("config.json");
    write_config_file(&sidebar_config_path, features, locale)?;

    Ok(())
}

/// 写入 Manager 补丁文件
fn write_manager_patches(
    workbench_dir: &Path,
    manager_features: &ManagerFeatureConfig,
    locale: Option<&str>,
) -> PatchResult<()> {
    let manager_panel_dir = workbench_dir.join("manager-panel");

    // 先删除旧目录, 确保文件结构干净
    if manager_panel_dir.exists() {
        fs::remove_dir_all(&manager_panel_dir).map_err(|e| {
            patch_with(
                locale,
                "patchBackend.errors.removeOldManagerDirFailed",
                &[("detail", e.to_string())],
            )
        })?;
    }

    // 创建目录
    fs::create_dir_all(&manager_panel_dir).map_err(|e| {
        patch_with(
            locale,
            "patchBackend.errors.createManagerDirFailed",
            &[("detail", e.to_string())],
        )
    })?;

    // 写入 Manager 相关补丁文件
    let patch_files =
        embedded::get_all_files_runtime().map_err(|e| map_embedded_error(locale, e))?;
    for (relative_path, content) in patch_files {
        // 只处理 Manager 相关文件
        if relative_path != "workbench-jetski-agent.html"
            && !relative_path.starts_with("manager-panel/")
        {
            continue;
        }

        let full_path = workbench_dir.join(&relative_path);

        // 确保父目录存在
        if let Some(parent) = full_path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent).map_err(|e| {
                    patch_with(
                        locale,
                        "patchBackend.errors.createDirFailed",
                        &[("detail", e.to_string())],
                    )
                })?;
            }
        }

        fs::write(&full_path, content).map_err(|e| {
            patch_with(
                locale,
                "patchBackend.errors.writeFileFailed",
                &[("detail", format!("{:?}: {}", full_path, e))],
            )
        })?;
    }

    // 生成 Manager 配置文件
    let manager_config_path = manager_panel_dir.join("config.json");
    write_manager_config_file(&manager_config_path, manager_features, locale)?;

    Ok(())
}

/// 写入侧边栏配置文件
fn write_config_file(
    config_path: &Path,
    features: &FeatureConfig,
    locale: Option<&str>,
) -> PatchResult<()> {
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

    let content = serde_json::to_string_pretty(&config_content).map_err(|e| {
        patch_with(
            locale,
            "patchBackend.errors.writeConfigFailed",
            &[("detail", e.to_string())],
        )
    })?;

    fs::write(config_path, content).map_err(|e| {
        patch_with(
            locale,
            "patchBackend.errors.writeConfigFailed",
            &[("detail", e.to_string())],
        )
    })?;

    Ok(())
}

/// 写入 Manager 配置文件
fn write_manager_config_file(
    config_path: &Path,
    features: &ManagerFeatureConfig,
    locale: Option<&str>,
) -> PatchResult<()> {
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

    let content = serde_json::to_string_pretty(&config_content).map_err(|e| {
        patch_with(
            locale,
            "patchBackend.errors.writeManagerConfigFailed",
            &[("detail", e.to_string())],
        )
    })?;

    fs::write(config_path, content).map_err(|e| {
        patch_with(
            locale,
            "patchBackend.errors.writeManagerConfigFailed",
            &[("detail", e.to_string())],
        )
    })?;

    Ok(())
}

/// 恢复旧版侧边栏文件 (禁用补丁时调用)
fn restore_legacy_sidebar_files(extensions_dir: &Path, locale: Option<&str>) -> PatchResult<()> {
    // 恢复 cascade-panel.html
    let cascade_panel = extensions_dir.join("cascade-panel.html");
    let cascade_backup = extensions_dir.join("cascade-panel.html.bak");
    if cascade_backup.exists() {
        fs::copy(&cascade_backup, &cascade_panel).map_err(|e| {
            patch_with(
                locale,
                "patchBackend.errors.restoreCascadeFailed",
                &[("detail", e.to_string())],
            )
        })?;
        let _ = fs::remove_file(&cascade_backup);
    }

    // 删除侧边栏补丁目录
    let cascade_dir = extensions_dir.join("cascade-panel");
    if cascade_dir.exists() {
        fs::remove_dir_all(&cascade_dir).map_err(|e| {
            patch_with(
                locale,
                "patchBackend.errors.removeCascadeDirFailed",
                &[("detail", e.to_string())],
            )
        })?;
    }

    Ok(())
}

/// 恢复新版侧边栏文件 (禁用补丁时调用)
fn restore_modern_sidebar_files(workbench_dir: &Path, locale: Option<&str>) -> PatchResult<()> {
    // 恢复 workbench.html
    let workbench = workbench_dir.join("workbench.html");
    let workbench_backup = workbench_dir.join("workbench.html.bak");
    if workbench_backup.exists() {
        fs::copy(&workbench_backup, &workbench).map_err(|e| {
            patch_with(
                locale,
                "patchBackend.errors.restoreCascadeFailed",
                &[("detail", e.to_string())],
            )
        })?;
        let _ = fs::remove_file(&workbench_backup);
    }

    // 删除新版侧边栏补丁目录
    let sidebar_dir = workbench_dir.join("sidebar-panel");
    if sidebar_dir.exists() {
        fs::remove_dir_all(&sidebar_dir).map_err(|e| {
            patch_with(
                locale,
                "patchBackend.errors.removeCascadeDirFailed",
                &[("detail", e.to_string())],
            )
        })?;
    }

    Ok(())
}

/// 恢复 Manager 文件 (禁用补丁时调用)
fn restore_manager_files(workbench_dir: &Path, locale: Option<&str>) -> PatchResult<()> {
    // 恢复 workbench-jetski-agent.html
    let jetski_agent = workbench_dir.join("workbench-jetski-agent.html");
    let jetski_backup = workbench_dir.join("workbench-jetski-agent.html.bak");
    if jetski_backup.exists() {
        fs::copy(&jetski_backup, &jetski_agent).map_err(|e| {
            patch_with(
                locale,
                "patchBackend.errors.restoreManagerEntryFailed",
                &[("detail", e.to_string())],
            )
        })?;
        let _ = fs::remove_file(&jetski_backup);
    }

    // 删除 Manager 补丁目录
    let manager_dir = workbench_dir.join("manager-panel");
    if manager_dir.exists() {
        fs::remove_dir_all(&manager_dir).map_err(|e| {
            patch_with(
                locale,
                "patchBackend.errors.removeManagerDirFailed",
                &[("detail", e.to_string())],
            )
        })?;
    }

    Ok(())
}

/// 恢复所有备份文件 (完全卸载时调用)
fn restore_backup_files(
    extensions_dir: &Path,
    workbench_dir: &Path,
    locale: Option<&str>,
) -> PatchResult<()> {
    restore_legacy_sidebar_files(extensions_dir, locale)?;
    restore_modern_sidebar_files(workbench_dir, locale)?;
    restore_manager_files(workbench_dir, locale)?;
    Ok(())
}

/// 清理 product.json 中的指定 checksums 条目
/// 补丁修改了某些文件后，如果不移除对应的校验和，Antigravity 会报"已损坏"
fn clean_checksums(product_json_path: &Path, locale: Option<&str>) -> PatchResult<()> {
    if !product_json_path.exists() {
        // product.json 不存在，跳过
        return Ok(());
    }

    // 读取 product.json
    let content = fs::read_to_string(product_json_path).map_err(|e| {
        patch_with(
            locale,
            "patchBackend.errors.readProductJsonFailed",
            &[("detail", e.to_string())],
        )
    })?;

    let mut json: Value = serde_json::from_str(&content).map_err(|e| {
        patch_with(
            locale,
            "patchBackend.errors.parseProductJsonFailed",
            &[("detail", e.to_string())],
        )
    })?;

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
                let new_content = serde_json::to_string_pretty(&json).map_err(|e| {
                    patch_with(
                        locale,
                        "patchBackend.errors.serializeProductJsonFailed",
                        &[("detail", e.to_string())],
                    )
                })?;

                fs::write(product_json_path, new_content).map_err(|e| {
                    patch_with(
                        locale,
                        "patchBackend.errors.writeProductJsonFailed",
                        &[("detail", e.to_string())],
                    )
                })?;
            }
        }
    }

    Ok(())
}

fn resolve_antigravity_root(path: &str, locale: Option<&str>) -> PatchResult<PathBuf> {
    let input = PathBuf::from(path);
    paths::normalize_antigravity_root(&input)
        .ok_or_else(|| patch_text(locale, "patchBackend.errors.invalidInstallDir"))
}

fn is_permission_error(error: &CommandError) -> bool {
    let lower = error.details_for_match().to_ascii_lowercase();
    lower.contains("permission denied")
        || lower.contains("operation not permitted")
        || lower.contains("read-only file system")
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn should_use_privileged(resources_root: &Path) -> bool {
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
fn should_use_privileged(_resources_root: &Path) -> bool {
    false
}

fn first_unwritable_dir(dirs: &[&Path], locale: Option<&str>) -> PatchResult<Option<PathBuf>> {
    for dir in dirs {
        match can_write_dir(dir, locale)? {
            true => {}
            false => return Ok(Some(dir.to_path_buf())),
        }
    }
    Ok(None)
}

fn can_write_dir(dir: &Path, locale: Option<&str>) -> PatchResult<bool> {
    let test_path = dir.join(".anti-power-write-test");
    match fs::OpenOptions::new()
        .create(true)
        .truncate(true)
        .write(true)
        .open(&test_path)
    {
        Ok(_) => {
            let _ = fs::remove_file(&test_path);
            Ok(true)
        }
        Err(err) => match err.kind() {
            ErrorKind::PermissionDenied | ErrorKind::ReadOnlyFilesystem => Ok(false),
            _ => Err(patch_with(
                locale,
                "patchBackend.errors.cannotWriteDir",
                &[("detail", format!("{}: {}", dir.display(), err))],
            )),
        },
    }
}

fn is_zh_locale(locale: Option<&str>) -> bool {
    i18n::is_zh_locale(locale)
}

fn select_privileged_script(locale: Option<&str>) -> &'static str {
    if is_zh_locale(locale) {
        "anti-power.sh"
    } else {
        "anti-power.en.sh"
    }
}

fn handle_privileged_or_error(
    mode: PatchMode,
    resources_root: &Path,
    features: Option<&FeatureConfig>,
    manager_features: Option<&ManagerFeatureConfig>,
    dir: &Path,
    locale: Option<&str>,
) -> PatchResult<()> {
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        let _ = dir;
        run_privileged_patch(mode, resources_root, features, manager_features, locale)
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        Err(patch_with(
            locale,
            "patchBackend.errors.permissionDeniedDir",
            &[("dir", dir.display().to_string())],
        ))
    }
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
struct TempDirGuard {
    path: PathBuf,
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
impl TempDirGuard {
    fn new(path: PathBuf) -> Self {
        Self { path }
    }

    fn path(&self) -> &Path {
        &self.path
    }
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
impl Drop for TempDirGuard {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn run_privileged_patch(
    mode: PatchMode,
    resources_root: &Path,
    features: Option<&FeatureConfig>,
    manager_features: Option<&ManagerFeatureConfig>,
    locale: Option<&str>,
) -> PatchResult<()> {
    let temp_dir = TempDirGuard::new(prepare_temp_patch_dir(locale)?);
    write_embedded_files_to_dir(temp_dir.path(), locale)?;

    if matches!(mode, PatchMode::Install | PatchMode::UpdateConfig) {
        let feature_config = features
            .ok_or_else(|| patch_text(locale, "patchBackend.errors.missingSidebarConfig"))?;
        let manager_config = manager_features
            .ok_or_else(|| patch_text(locale, "patchBackend.errors.missingManagerConfig"))?;

        let cascade_config_path = temp_dir.path().join("cascade-panel").join("config.json");
        write_config_file(&cascade_config_path, feature_config, locale)?;

        let sidebar_config_path = temp_dir.path().join("sidebar-panel").join("config.json");
        write_config_file(&sidebar_config_path, feature_config, locale)?;

        let manager_config_path = temp_dir.path().join("manager-panel").join("config.json");
        write_manager_config_file(&manager_config_path, manager_config, locale)?;
    }

    let script_name = select_privileged_script(locale);
    let script_path = temp_dir.path().join(script_name);
    if !script_path.exists() {
        return Err(patch_with(
            locale,
            "patchBackend.errors.notFound",
            &[("name", script_name.to_string())],
        ));
    }

    ensure_script_executable(&script_path, locale)?;

    let cascade_enabled = features.map(|config| config.enabled).unwrap_or(true);
    let manager_enabled = manager_features
        .map(|config| config.enabled)
        .unwrap_or(true);
    let args = build_script_args(mode, resources_root, cascade_enabled, manager_enabled);
    let status_path = temp_dir.path().join("privileged-status.txt");

    match run_privileged_script(&script_path, &args, &status_path, locale) {
        Ok(()) => Ok(()),
        Err(err) => {
            let message = annotate_privileged_error(err, resources_root, locale);
            Err(patch_with(
                locale,
                "patchBackend.errors.privilegedScriptFailed",
                &[("message", message)],
            ))
        }
    }
}

fn annotate_privileged_error(
    error: CommandError,
    resources_root: &Path,
    locale: Option<&str>,
) -> String {
    let details = error.details_for_match();
    let message = error.to_message(locale);

    #[cfg(target_os = "macos")]
    {
        let lower = details.to_ascii_lowercase();
        if lower.contains("operation not permitted") || details.contains("权限") {
            return patch_with(
                locale,
                "patchBackend.errors.macosPermissionHint",
                &[
                    ("message", message.clone()),
                    ("path", resources_root.display().to_string()),
                ],
            )
            .to_message(locale);
        }
    }

    let _ = (resources_root, locale);
    message
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
fn run_privileged_patch(
    _mode: PatchMode,
    _resources_root: &Path,
    _features: Option<&FeatureConfig>,
    _manager_features: Option<&ManagerFeatureConfig>,
    _locale: Option<&str>,
) -> PatchResult<()> {
    Err(patch_text(
        _locale,
        "patchBackend.errors.unsupportedPrivilegedFlow",
    ))
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn prepare_temp_patch_dir(locale: Option<&str>) -> PatchResult<PathBuf> {
    use std::time::{SystemTime, UNIX_EPOCH};

    for attempt in 0..8 {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let dir = env::temp_dir().join(format!(
            "anti-power-privileged-{}-{}-{}",
            std::process::id(),
            nonce,
            attempt
        ));

        match fs::create_dir(&dir) {
            Ok(()) => return Ok(dir),
            Err(err) if err.kind() == ErrorKind::AlreadyExists => continue,
            Err(err) => {
                return Err(patch_with(
                    locale,
                    "patchBackend.errors.createTempDirFailed",
                    &[("detail", err.to_string())],
                ));
            }
        }
    }

    Err(patch_text(
        locale,
        "patchBackend.errors.allocateUniqueTempDirFailed",
    ))
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn write_embedded_files_to_dir(root: &Path, locale: Option<&str>) -> PatchResult<()> {
    let patch_files =
        embedded::get_all_files_runtime().map_err(|e| map_embedded_error(locale, e))?;
    for (relative_path, content) in patch_files {
        let full_path = root.join(&relative_path);
        if let Some(parent) = full_path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent).map_err(|e| {
                    patch_with(
                        locale,
                        "patchBackend.errors.createDirFailed",
                        &[("detail", e.to_string())],
                    )
                })?;
            }
        }

        fs::write(&full_path, content).map_err(|e| {
            patch_with(
                locale,
                "patchBackend.errors.writeFileFailed",
                &[("detail", format!("{:?}: {}", full_path, e))],
            )
        })?;
    }

    Ok(())
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn ensure_script_executable(script_path: &Path, locale: Option<&str>) -> PatchResult<()> {
    #[cfg(unix)]
    {
        let mut perms = fs::metadata(script_path)
            .map_err(|e| {
                patch_with(
                    locale,
                    "patchBackend.errors.readScriptPermissionsFailed",
                    &[("detail", e.to_string())],
                )
            })?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(script_path, perms).map_err(|e| {
            patch_with(
                locale,
                "patchBackend.errors.setScriptPermissionsFailed",
                &[("detail", e.to_string())],
            )
        })?;
    }

    Ok(())
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn build_script_args(
    mode: PatchMode,
    resources_root: &Path,
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
    script_path: &Path,
    args: &[String],
    status_path: &Path,
    locale: Option<&str>,
) -> PatchResult<()> {
    let mut command_parts = Vec::new();
    command_parts.push(shell_quote("/bin/bash"));
    command_parts.push(shell_quote(script_path.to_string_lossy().as_ref()));
    for arg in args {
        command_parts.push(shell_quote(arg));
    }

    let command_line = command_parts.join(" ");
    let status_path_quoted = shell_quote(status_path.to_string_lossy().as_ref());
    let terminal_command = format!("sudo {} ; echo $? > {}", command_line, status_path_quoted);
    let apple_script = format!(
        "tell application \"Terminal\"\nactivate\ndo script \"{}\"\nend tell",
        escape_applescript_string(&terminal_command)
    );

    Command::new("osascript")
        .arg("-e")
        .arg(apple_script)
        .output()
        .map_err(|e| {
            patch_with(
                locale,
                "patchBackend.errors.invokeTerminalFailed",
                &[("detail", e.to_string())],
            )
        })?;

    wait_for_status(status_path, std::time::Duration::from_secs(900), locale)
}

#[cfg(target_os = "linux")]
fn run_privileged_script(
    script_path: &Path,
    args: &[String],
    _status_path: &Path,
    locale: Option<&str>,
) -> PatchResult<()> {
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
            if !stderr.is_empty() {
                Err(CommandError::from(stderr))
            } else if !stdout.is_empty() {
                Err(CommandError::from(stdout))
            } else {
                Err(patch_text(
                    locale,
                    "patchBackend.errors.privilegedCanceledOrFailed",
                ))
            }
        }
        Err(err) if err.kind() == ErrorKind::NotFound => {
            Err(patch_text(locale, "patchBackend.errors.pkexecNotFound"))
        }
        Err(err) => Err(patch_with(
            locale,
            "patchBackend.errors.executePkexecFailed",
            &[("detail", err.to_string())],
        )),
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
fn wait_for_status(
    status_path: &Path,
    timeout: std::time::Duration,
    locale: Option<&str>,
) -> PatchResult<()> {
    let start = std::time::Instant::now();
    while start.elapsed() < timeout {
        if status_path.exists() {
            let content = fs::read_to_string(status_path).map_err(|e| {
                patch_with(
                    locale,
                    "patchBackend.errors.readStatusFileFailed",
                    &[("detail", e.to_string())],
                )
            })?;
            let _ = fs::remove_file(status_path);
            let code = content.trim().parse::<i32>().unwrap_or(1);
            if code == 0 {
                return Ok(());
            }
            return Err(patch_with(
                locale,
                "patchBackend.errors.terminalCommandFailedCode",
                &[("code", code.to_string())],
            ));
        }
        std::thread::sleep(std::time::Duration::from_millis(500));
    }

    Err(patch_text(
        locale,
        "patchBackend.errors.terminalNotFinished",
    ))
}
