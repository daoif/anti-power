//! Embedded patch assets
//!
//! Embed patch files with `include_str!` at compile time
//! Development builds can read the live patch files from disk

use std::fs;
use std::path::PathBuf;

#[derive(Debug)]
pub enum EmbeddedError {
    PatchesDirNotFound,
    ReadPatchFileFailed { path: PathBuf, detail: String },
}

// The build script generates this manifest
include!(concat!(env!("OUT_DIR"), "/embedded_patches.rs"));

/// Return all embedded patch files
/// Each tuple contains a relative path and the file contents
pub fn get_all_files() -> Vec<(&'static str, &'static str)> {
    EMBEDDED_FILES.to_vec()
}

/// Locate the `patches` directory
/// Check the current directory and up to five ancestors
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

/// Load all patch files at runtime
///
/// Development builds read files from disk so patch edits take effect without rebuilding
/// Release builds use the embedded patch files
pub fn get_all_files_runtime() -> Result<Vec<(String, String)>, EmbeddedError> {
    if cfg!(debug_assertions) {
        let patches_dir = find_patches_dir().ok_or(EmbeddedError::PatchesDirNotFound)?;
        let mut files = Vec::new();
        for (relative_path, _) in get_all_files() {
            let full_path = patches_dir.join(relative_path);
            let content =
                fs::read_to_string(&full_path).map_err(|e| EmbeddedError::ReadPatchFileFailed {
                    path: full_path.clone(),
                    detail: e.to_string(),
                })?;
            files.push((relative_path.to_string(), content));
        }
        return Ok(files);
    }

    Ok(get_all_files()
        .into_iter()
        .map(|(path, content)| (path.to_string(), content.to_string()))
        .collect())
}
