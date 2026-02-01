use std::path::{Path, PathBuf};

fn resources_dir_name() -> &'static str {
    if cfg!(target_os = "macos") {
        "Resources"
    } else {
        "resources"
    }
}

pub fn resources_app_root(root: &Path) -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        let resources = root.join(resources_dir_name());
        if resources.exists() {
            return resources.join("app");
        }

        return root.join("resources").join("app");
    }

    #[cfg(not(target_os = "macos"))]
    {
        root.join("resources").join("app")
    }
}

pub fn is_valid_antigravity_root(root: &Path) -> bool {
    resources_app_root(root)
        .join("extensions")
        .join("antigravity")
        .join("cascade-panel.html")
        .exists()
}

pub fn normalize_antigravity_root(input: &Path) -> Option<PathBuf> {
    let mut seeds = Vec::new();
    seeds.push(input.to_path_buf());

    if is_app_bundle(input) {
        seeds.push(input.join("Contents"));
    }

    if let Some(base) = strip_tail_components_ci(input, &["resources", "app"]) {
        seeds.push(base);
    }

    if let Some(base) = strip_tail_components_ci(input, &["resources"]) {
        seeds.push(base);
    }

    for seed in seeds {
        for ancestor in seed.ancestors() {
            if is_valid_antigravity_root(ancestor) {
                return Some(ancestor.to_path_buf());
            }
        }
    }

    None
}

fn is_app_bundle(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.to_ascii_lowercase().ends_with(".app"))
        .unwrap_or(false)
}

fn strip_tail_components_ci(path: &Path, tail: &[&str]) -> Option<PathBuf> {
    if !ends_with_components_ci(path, tail) {
        return None;
    }

    strip_tail_components(path, tail.len())
}

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
