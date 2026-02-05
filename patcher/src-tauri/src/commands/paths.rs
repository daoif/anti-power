//! 路径处理模块
//!
//! 提供 Antigravity 安装路径的规范化和验证功能

use std::path::{Path, PathBuf};

/// 获取资源目录名称
/// macOS 使用 "Resources"，其他平台使用 "resources"
fn resources_dir_name() -> &'static str {
    if cfg!(target_os = "macos") {
        "Resources"
    } else {
        "resources"
    }
}

/// 获取资源应用根目录
/// 根据平台返回正确的 resources/app 路径
pub fn resources_app_root(root: &Path) -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        let resources = root.join(resources_dir_name());
        if resources.exists() {
            return resources.join("app");
        }

        root.join("resources").join("app")
    }

    #[cfg(not(target_os = "macos"))]
    {
        root.join("resources").join("app")
    }
}

/// 验证是否为有效的 Antigravity 安装根目录
/// 通过检查 cascade-panel.html 是否存在来判断
pub fn is_valid_antigravity_root(root: &Path) -> bool {
    resources_app_root(root)
        .join("extensions")
        .join("antigravity")
        .join("cascade-panel.html")
        .exists()
}

/// 规范化 Antigravity 安装路径
/// 将用户输入的路径转换为标准的根目录路径
pub fn normalize_antigravity_root(input: &Path) -> Option<PathBuf> {
    let mut seeds = Vec::new();
    seeds.push(input.to_path_buf());

    // 处理 .app 包
    if is_app_bundle(input) {
        seeds.push(input.join("Contents"));
    }

    // 处理 resources/app 后缀
    if let Some(base) = strip_tail_components_ci(input, &["resources", "app"]) {
        seeds.push(base);
    }

    // 处理 resources 后缀
    if let Some(base) = strip_tail_components_ci(input, &["resources"]) {
        seeds.push(base);
    }

    // 遍历所有候选路径，找到第一个有效的根目录
    for seed in seeds {
        for ancestor in seed.ancestors() {
            if is_valid_antigravity_root(ancestor) {
                return Some(ancestor.to_path_buf());
            }
        }
    }

    None
}

/// 判断路径是否为 macOS 应用包
fn is_app_bundle(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.to_ascii_lowercase().ends_with(".app"))
        .unwrap_or(false)
}

/// 移除路径尾部的指定组件（大小写不敏感）
fn strip_tail_components_ci(path: &Path, tail: &[&str]) -> Option<PathBuf> {
    if !ends_with_components_ci(path, tail) {
        return None;
    }

    strip_tail_components(path, tail.len())
}

/// 移除路径尾部指定数量的组件
fn strip_tail_components(path: &Path, count: usize) -> Option<PathBuf> {
    let components: Vec<_> = path.components().collect();
    if components.len() < count {
        return None;
    }

    let mut base = PathBuf::new();
    for component in &components[..components.len() - count] {
        base.push(component.as_os_str());
    }

    Some(base)
}

/// 判断路径是否以指定组件结尾（大小写不敏感）
fn ends_with_components_ci(path: &Path, tail: &[&str]) -> bool {
    let tail_lower: Vec<String> = tail.iter().map(|item| item.to_ascii_lowercase()).collect();
    let components: Vec<String> = path
        .components()
        .filter_map(|component| component.as_os_str().to_str().map(|s| s.to_ascii_lowercase()))
        .collect();

    if components.len() < tail_lower.len() {
        return false;
    }

    let start = components.len() - tail_lower.len();
    components[start..]
        .iter()
        .zip(tail_lower.iter())
        .all(|(left, right)| left == right)
}
