// Embedded patch assets
// Embed patch files with include_str! at compile time
use std::fs;
use std::path::PathBuf;

include!(concat!(env!("OUT_DIR"), "/embedded_patches.rs"));

/// All files in the patch payload
pub fn get_all_files() -> Vec<(&'static str, &'static str)> {
    EMBEDDED_FILES.to_vec()
}

fn find_patches_dir() -> Option<PathBuf> {
    let mut dir = std::env::current_dir().ok()?;

    for _ in 0..6 {
        let direct = dir.join("patches");
        if direct.is_dir() {
            return Some(direct);
        }

        let nested = dir.join("patcher").join("patches");
        if nested.is_dir() {
            return Some(nested);
        }

        if !dir.pop() {
            break;
        }
    }

    None
}

pub fn get_all_files_runtime() -> Result<Vec<(String, String)>, String> {
    if cfg!(debug_assertions) {
        let patches_dir = find_patches_dir()
            .ok_or_else(|| "未找到 patches 目录，请从项目根目录或 patcher 目录启动".to_string())?;
        let mut files = Vec::new();
        for (relative_path, _) in get_all_files() {
            let full_path = patches_dir.join(relative_path);
            let content = fs::read_to_string(&full_path)
                .map_err(|e| format!("读取补丁文件失败 {:?}: {}", full_path, e))?;
            files.push((relative_path.to_string(), content));
        }
        return Ok(files);
    }

    Ok(get_all_files()
        .into_iter()
        .map(|(path, content)| (path.to_string(), content.to_string()))
        .collect())
}
