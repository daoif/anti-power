//! 嵌入的补丁资源模块
//!
//! 使用 include_str! 将文件内容在编译时嵌入到二进制中
//! 支持开发模式下从磁盘实时读取文件

use std::fs;
use std::path::PathBuf;

#[derive(Debug)]
pub enum EmbeddedError {
    PatchesDirNotFound,
    ReadPatchFileFailed { path: PathBuf, detail: String },
}

// 编译时生成的嵌入文件列表
include!(concat!(env!("OUT_DIR"), "/embedded_patches.rs"));

/// 获取所有嵌入的补丁文件列表
/// 返回 (相对路径, 文件内容) 的元组列表
pub fn get_all_files() -> Vec<(&'static str, &'static str)> {
    EMBEDDED_FILES.to_vec()
}

/// 查找 patches 目录
/// 从当前目录向上搜索，最多查找 6 层
fn find_patches_dir() -> Option<PathBuf> {
    let mut dir = std::env::current_dir().ok()?;

    for _ in 0..6 {
        // 直接子目录
        let direct = dir.join("patches");
        if direct.is_dir() {
            return Some(direct);
        }

        // patcher 子目录下
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

/// 运行时获取所有补丁文件
///
/// 开发模式下从磁盘实时读取文件（便于热更新调试）
/// 发布模式下使用编译时嵌入的文件内容
pub fn get_all_files_runtime() -> Result<Vec<(String, String)>, EmbeddedError> {
    // 开发模式：从磁盘读取
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

    // 发布模式：使用嵌入的文件
    Ok(get_all_files()
        .into_iter()
        .map(|(path, content)| (path.to_string(), content.to_string()))
        .collect())
}
