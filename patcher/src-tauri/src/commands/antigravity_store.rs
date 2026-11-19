use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};

pub(super) const DESKTOP: &str = "antigravity";
pub(super) const CLI: &str = "agy";
pub(super) const INDEX_DB: &str = "conversation_summaries.db";
pub(super) const METADATA: &str = "cache/conversation_metadata.json";

pub(super) fn roots(home: &Path, provider_id: &str) -> io::Result<Vec<PathBuf>> {
    let gemini = home.join(".gemini");
    match provider_id {
        DESKTOP => Ok(vec![gemini.join("antigravity")]),
        CLI => {
            let mut roots = vec![gemini.join("antigravity-cli")];
            let profiles = home.join(".cc-switch").join("agy");
            match fs::read_dir(profiles) {
                Ok(entries) => {
                    for entry in entries {
                        let entry = entry?;
                        if entry.file_type()?.is_dir() {
                            let root = entry.path().join("antigravity-cli");
                            if root.is_dir() {
                                roots.push(root);
                            }
                        }
                    }
                }
                // CC Switch profiles are optional, so a missing directory is not an error
                Err(error)
                    if matches!(
                        error.kind(),
                        io::ErrorKind::NotFound | io::ErrorKind::NotADirectory
                    ) => {}
                Err(error) => return Err(error),
            }
            roots[1..].sort();
            Ok(roots)
        }
        _ => Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "Unknown Antigravity session source",
        )),
    }
}

pub(super) fn valid_id(id: &str) -> bool {
    id.len() == 36
        && id.bytes().enumerate().all(|(index, byte)| {
            if matches!(index, 8 | 13 | 18 | 23) {
                byte == b'-'
            } else {
                byte.is_ascii_hexdigit()
            }
        })
}

pub(super) fn locate(
    home: &Path,
    provider_id: &str,
    source_path: &Path,
) -> Result<(PathBuf, String), String> {
    let id = source_path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .filter(|id| valid_id(id))
        .ok_or("Invalid Antigravity conversation ID")?;
    let root = roots(home, provider_id)
        .map_err(|error| error.to_string())?
        .into_iter()
        .find(|root| root.join("conversations").join(format!("{id}.db")) == source_path)
        .ok_or("Unexpected Antigravity conversation path")?;
    Ok((root, id.to_owned()))
}

/// Resolve a known store path without traversing symlinks
pub(super) fn checked_path(root: &Path, relative: &Path) -> io::Result<Option<PathBuf>> {
    let mut path = root.to_path_buf();
    let mut components = relative.components().peekable();
    while let Some(Component::Normal(part)) = components.next() {
        path.push(part);
        match fs::symlink_metadata(&path) {
            Ok(metadata)
                if !metadata.file_type().is_symlink()
                    && (components.peek().is_none() || metadata.is_dir()) => {}
            Ok(_) => {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    format!("Unexpected file at {}", path.display()),
                ));
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(error),
        }
        if components.peek().is_none() {
            return Ok(Some(path));
        }
    }
    Err(io::Error::new(
        io::ErrorKind::InvalidInput,
        "Invalid store path",
    ))
}
