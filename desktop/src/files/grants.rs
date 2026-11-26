//! Which files the editor may read and write. The editor reaches a file only once the person
//! gave it: picked in an Open or Save dialog, opened from the system, or allowed in the
//! permission window when an agent asked. Those grants are kept in the app's data folder and
//! given again at the next launch, so recent files and open tabs still open.

use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;

use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_fs::FsExt;

/// Where the grants are kept, in the app's data folder.
const GRANTS_FILE: &str = "file-grants.json";
/// How many grants are kept, newest first; older ones are given up.
const MAX_GRANTS: usize = 2000;
/// The partial file a save writes before moving it over the document.
const SAVING_SUFFIX: &str = ".saving";

/// The files a document may name beside itself: a `.pen` document's images, fonts, and the
/// documents it imports, and a page's pictures, stylesheets, and fonts. Anything else beside it
/// stays out of reach.
const ASSET_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "ico", "svg", "ttf", "otf", "woff", "woff2",
    "css", "pen",
];

#[derive(Default)]
pub struct FileGrants {
    paths: Mutex<Vec<String>>,
}

fn grants_file<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|dir| dir.join(GRANTS_FILE))
}

/// Gives the editor the files granted before, and keeps every new grant.
pub fn restore<R: Runtime>(app: &AppHandle<R>) {
    let saved: Vec<String> = grants_file(app)
        .and_then(|file| std::fs::read(file).ok())
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default();
    let scope = app.fs_scope();
    for path in &saved {
        let path = Path::new(path);
        let _ = if path.is_dir() {
            scope.allow_directory(path, false)
        } else {
            scope.allow_file(path)
        };
    }
    *app.state::<FileGrants>().paths.lock().unwrap_or_else(|p| p.into_inner()) = saved;

    let handle = app.clone();
    scope.listen(move |event| {
        let tauri::fs::Event::PathAllowed(path) = event else {
            return;
        };
        let path = path.to_string_lossy().into_owned();
        // A save's partial file has a name of its own each time, and is gone once it is moved.
        if path.ends_with(SAVING_SUFFIX) {
            return;
        }
        let grants = handle.state::<FileGrants>();
        let mut paths = grants.paths.lock().unwrap_or_else(|p| p.into_inner());
        paths.retain(|kept| kept != &path);
        paths.insert(0, path);
        paths.truncate(MAX_GRANTS);
        if let (Some(file), Ok(json)) = (grants_file(&handle), serde_json::to_vec(&*paths)) {
            if let Err(error) = std::fs::write(&file, json) {
                eprintln!("[grants] could not keep the file grants: {error}");
            }
        }
    });
}

fn from_editor<R: Runtime>(webview: &tauri::Webview<R>) -> Result<(), String> {
    if webview.label() == "main" {
        Ok(())
    } else {
        Err("Only the editor reaches documents.".to_owned())
    }
}

fn granted<R: Runtime>(app: &AppHandle<R>, path: &Path) -> Result<(), String> {
    if app.fs_scope().is_allowed(path) {
        Ok(())
    } else {
        Err(format!("forbidden path: {}", path.display()))
    }
}

/// Gives the editor a file, as the Open dialog would, for native tests that cannot answer one.
#[cfg(feature = "native-test")]
#[tauri::command]
pub fn native_test_allow_file<R: Runtime>(app: AppHandle<R>, path: PathBuf) -> Result<(), String> {
    app.fs_scope().allow_file(path).map_err(|e| e.to_string())
}

/// The partial file a save to `path` writes, which the editor may then write and move over the
/// document. `path` must be a file the editor was given.
#[tauri::command]
pub fn allow_save_partial<R: Runtime>(
    app: AppHandle<R>,
    webview: tauri::Webview<R>,
    path: PathBuf,
) -> Result<PathBuf, String> {
    from_editor(&webview)?;
    granted(&app, &path)?;
    let mut bytes = [0u8; 4];
    getrandom::fill(&mut bytes).map_err(|e| e.to_string())?;
    let mut name = path.as_os_str().to_owned();
    name.push(format!(
        ".{}{SAVING_SUFFIX}",
        bytes.iter().map(|b| format!("{b:02x}")).collect::<String>()
    ));
    let partial = PathBuf::from(name);
    app.fs_scope()
        .allow_file(&partial)
        .map_err(|e| e.to_string())?;
    Ok(partial)
}

/// The asset a document opened from `document` names relative to itself, read from the
/// document's folder only: a path that leaves the folder, passes a link or a hidden name, or is
/// not an image, a font, a stylesheet, or an imported `.pen` reads as no bytes.
#[tauri::command]
pub async fn read_document_asset<R: Runtime>(
    app: AppHandle<R>,
    webview: tauri::Webview<R>,
    document: PathBuf,
    relative: String,
) -> Result<tauri::ipc::Response, String> {
    from_editor(&webview)?;
    granted(&app, &document)?;
    let bytes = match asset_path(&document, &relative) {
        Some(target) => tauri::async_runtime::spawn_blocking(move || std::fs::read(target))
            .await
            .map_err(|e| e.to_string())?
            .unwrap_or_default(),
        None => Vec::new(),
    };
    Ok(tauri::ipc::Response::new(bytes))
}

/// Where an asset named `relative` beside `document` is, if it may be read.
fn asset_path(document: &Path, relative: &str) -> Option<PathBuf> {
    let folder = document.parent()?;
    let mut target = folder.to_path_buf();
    for component in Path::new(relative).components() {
        match component {
            Component::Normal(part) => {
                if part.to_string_lossy().starts_with('.') {
                    return None;
                }
                target.push(part);
                // A link inside the folder could lead out of it.
                if std::fs::symlink_metadata(&target)
                    .map(|meta| meta.file_type().is_symlink())
                    .unwrap_or(false)
                {
                    return None;
                }
            }
            Component::CurDir => {}
            _ => return None,
        }
    }
    let extension = target.extension()?.to_string_lossy().to_ascii_lowercase();
    ASSET_EXTENSIONS
        .contains(&extension.as_str())
        .then_some(target)
        .filter(|path| path.is_file())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_only_assets_inside_the_documents_folder() {
        let dir = std::env::temp_dir().join(format!("op-assets-{}", std::process::id()));
        std::fs::create_dir_all(dir.join("images")).unwrap();
        std::fs::create_dir_all(dir.join(".hidden")).unwrap();
        for file in ["images/a.png", "notes.txt", ".hidden/b.png", "c.PNG"] {
            std::fs::write(dir.join(file), b"x").unwrap();
        }
        let document = dir.join("design.pen");
        assert_eq!(asset_path(&document, "images/a.png"), Some(dir.join("images/a.png")));
        assert_eq!(asset_path(&document, "./c.PNG"), Some(dir.join("c.PNG")));
        for refused in ["notes.txt", ".hidden/b.png", "../a.png", "/etc/hosts", "images/missing.png"] {
            assert_eq!(asset_path(&document, refused), None, "{refused}");
        }
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(dir.join("images"), dir.join("linked")).unwrap();
            assert_eq!(asset_path(&document, "linked/a.png"), None);
        }
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
