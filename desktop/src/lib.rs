mod fig_container;
mod fonts;
mod menu;
mod menu_events;
#[cfg(target_os = "macos")]
mod window;

use fig_container::build_fig_file;
use fonts::{list_system_fonts, load_system_font};
use menu::install_app_menu;
use menu_events::handle_menu_event;
use std::{
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{Emitter, Manager};
use tauri_plugin_fs::FsExt;
#[cfg(target_os = "macos")]
use window::show_main_window;

#[derive(Clone, serde::Serialize)]
struct PendingOpenFile {
    path: String,
}

struct PendingOpen(Mutex<Vec<PendingOpenFile>>);

#[tauri::command]
fn take_pending_open(state: tauri::State<PendingOpen>) -> Vec<PendingOpenFile> {
    state
        .0
        .lock()
        .map(|mut pending| pending.drain(..).collect())
        .unwrap_or_default()
}

fn file_association_path(path: PathBuf) -> Option<PathBuf> {
    let path = path.canonicalize().ok()?;
    if !path.is_file() {
        return None;
    }
    let ext = path.extension()?.to_string_lossy().to_lowercase();
    matches!(ext.as_str(), "fig" | "pen").then_some(path)
}

fn path_from_arg(arg: String, cwd: &Path) -> Option<PathBuf> {
    if arg.starts_with('-') {
        return None;
    }

    if let Ok(url) = tauri::Url::parse(&arg) {
        if let Ok(path) = url.to_file_path() {
            return Some(path);
        }
    }

    let path = PathBuf::from(arg);
    Some(if path.is_absolute() {
        path
    } else {
        cwd.join(path)
    })
}

fn open_paths_from_args(args: Vec<String>, cwd: &Path) -> Vec<PathBuf> {
    args.into_iter()
        .filter_map(|arg| path_from_arg(arg, cwd))
        .filter_map(file_association_path)
        .collect()
}

/// Collapse runs of consecutive forward slashes into a single slash.
fn collapse_duplicate_slashes(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut prev_slash = false;
    for ch in s.chars() {
        if ch == '/' {
            if prev_slash {
                continue;
            }
            prev_slash = true;
        } else {
            prev_slash = false;
        }
        out.push(ch);
    }
    out
}

fn strip_trailing_slash(s: &str) -> &str {
    s.strip_suffix('/').unwrap_or(s)
}

/// Normalise a path for identity comparison on the current platform.
///
/// - On Windows and macOS the filesystem is case-insensitive by default, so the
///   key is lowercased.
/// - On Linux the key preserves the original casing.
/// - Duplicate forward slashes are collapsed and a single trailing forward
///   slash is removed on all platforms.
/// - Backslashes are converted to forward slashes only on Windows.
/// - Windows verbatim prefixes (`\\?\` and `\\?\UNC\`) are stripped, and plain
///   UNC paths (`\\server\share`) keep their leading `//` after normalization.
/// - Non-UTF-8 bytes are replaced with the lossy replacement character; this is
///   a best-effort key and is unavoidable because `PendingOpenFile.path` is a
///   string sent to the frontend.
fn path_identity_key(path: &Path) -> String {
    let lossy = path.to_string_lossy();
    #[cfg(target_os = "windows")]
    {
        // Canonicalized Windows paths may carry the extended-length (`\\?\`) or
        // extended-length UNC (`\\?\UNC\`) verbatim prefix. Strip it before
        // slash normalization so the identity key matches ordinary paths sent
        // by the frontend. Plain UNC paths (`\\server\share`) keep their leading
        // `//` after normalization.
        let raw = lossy.into_owned();
        let (rest, is_unc) = if let Some(r) = raw.strip_prefix(r"\\?\UNC\") {
            (r, true)
        } else if let Some(r) = raw.strip_prefix(r"\\?\") {
            (r, false)
        } else if raw.starts_with("\\\\") {
            (&raw[2..], true)
        } else {
            (raw.as_str(), false)
        };

        let slash_normalized = rest.replace('\\', "/");
        let collapsed = collapse_duplicate_slashes(&slash_normalized);
        let without_trailing = strip_trailing_slash(&collapsed);
        let with_prefix = if is_unc {
            format!("//{}", without_trailing)
        } else {
            without_trailing.to_string()
        };

        with_prefix.to_lowercase()
    }
    #[cfg(target_os = "macos")]
    {
        let collapsed = collapse_duplicate_slashes(&lossy);
        strip_trailing_slash(&collapsed).to_lowercase()
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let collapsed = collapse_duplicate_slashes(&lossy);
        strip_trailing_slash(&collapsed).to_string()
    }
}

fn queue_open_paths<R: tauri::Runtime>(app: &tauri::AppHandle<R>, paths: Vec<PathBuf>) {
    let mut seen = std::collections::HashSet::new();
    let files = paths
        .into_iter()
        .filter_map(|path| {
            let key = path_identity_key(&path);
            if !seen.insert(key.clone()) {
                return None;
            }
            let _ = app.fs_scope().allow_file(&path);
            Some((
                PendingOpenFile {
                    path: path.to_string_lossy().into_owned(),
                },
                key,
            ))
        })
        .collect::<Vec<_>>();

    if files.is_empty() {
        return;
    }

    if let Ok(mut pending) = app.state::<PendingOpen>().0.lock() {
        for (file, file_key) in files {
            if pending
                .iter()
                .all(|p| path_identity_key(Path::new(&p.path)) != file_key)
            {
                pending.push(file);
            }
        }
    }

    let _ = app.emit("open-associated-files", ());
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_focus();
    }
}

fn startup_open_paths() -> Vec<PathBuf> {
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    open_paths_from_args(std::env::args().skip(1).collect(), &cwd)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = fix_path_env::fix();

    let mut builder = tauri::Builder::default();

    #[cfg(any(target_os = "macos", windows, target_os = "linux"))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            queue_open_paths(app, open_paths_from_args(args, Path::new(&cwd)));
        }));
    }

    builder
        .manage(PendingOpen(Mutex::new(Vec::new())))
        .invoke_handler(tauri::generate_handler![
            build_fig_file,
            list_system_fonts,
            load_system_font,
            take_pending_open
        ])
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .on_menu_event(|app, event| {
            handle_menu_event(app, event.id().0.as_str());
        })
        .setup(|app| {
            queue_open_paths(app.handle(), startup_open_paths());
            Ok(install_app_menu(app)?)
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, event| match event {
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Opened { urls } => {
                let paths = urls
                    .into_iter()
                    .filter_map(|url| url.to_file_path().ok())
                    .filter_map(file_association_path)
                    .collect();
                queue_open_paths(_app, paths);
            }
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Reopen {
                has_visible_windows,
                ..
            } => {
                if !has_visible_windows {
                    show_main_window(_app);
                }
            }
            _ => {}
        });
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::path_identity_key;

    #[test]
    fn windows_normalizes_slashes_before_case_folding() {
        // These assertions target Windows behaviour, but constructing the same
        // paths here is harmless on other platforms.
        #[cfg(target_os = "windows")]
        {
            assert_eq!(
                path_identity_key(Path::new(r"C:\foo\bar.txt")),
                "c:/foo/bar.txt"
            );
            assert_eq!(
                path_identity_key(Path::new(r"C:/foo\\bar.txt")),
                "c:/foo/bar.txt"
            );
            assert_eq!(path_identity_key(Path::new(r"C:\foo\\bar\")), "c:/foo/bar");
            assert_eq!(
                path_identity_key(Path::new(r"C:/foo//bar.txt")),
                "c:/foo/bar.txt"
            );
            assert_eq!(
                path_identity_key(Path::new(r"\\server\share\file.fig")),
                "//server/share/file.fig"
            );
            assert_eq!(
                path_identity_key(Path::new(r"\\server\share\dir\\")),
                "//server/share/dir"
            );
        }
    }

    #[test]
    fn windows_strips_verbatim_prefix_before_normalizing() {
        // These assertions target Windows behaviour, but constructing the same
        // paths here is harmless on other platforms.
        #[cfg(target_os = "windows")]
        {
            assert_eq!(
                path_identity_key(Path::new(r"\\?\C:\foo\bar.txt")),
                "c:/foo/bar.txt"
            );
            assert_eq!(
                path_identity_key(Path::new(r"\\?\C:\foo\bar.txt\\")),
                "c:/foo/bar.txt"
            );
            assert_eq!(
                path_identity_key(Path::new(r"\\?\UNC\server\share\file.fig")),
                "//server/share/file.fig"
            );
            assert_eq!(
                path_identity_key(Path::new(r"\\?\UNC\server\share\file.fig\\")),
                "//server/share/file.fig"
            );
            assert_eq!(
                path_identity_key(Path::new(r"\\?\UNC\Server\Share\dir")),
                "//server/share/dir"
            );
        }
    }

    #[test]
    fn case_folding_respects_platform_case_sensitivity() {
        #[cfg(target_os = "macos")]
        {
            assert_eq!(
                path_identity_key(Path::new("/Users/Joey/File.txt")),
                "/users/joey/file.txt"
            );
        }
        #[cfg(target_os = "linux")]
        {
            assert_eq!(
                path_identity_key(Path::new("/Users/Joey/File.txt")),
                "/Users/Joey/File.txt"
            );
        }
    }

    #[test]
    fn collapses_slashes_and_strips_trailing_slash_respecting_case_sensitivity() {
        #[cfg(target_os = "macos")]
        {
            assert_eq!(
                path_identity_key(Path::new("/Users/Joey//File.txt/")),
                "/users/joey/file.txt"
            );
        }
        #[cfg(target_os = "linux")]
        {
            assert_eq!(
                path_identity_key(Path::new("/Users/Joey//File.txt/")),
                "/Users/Joey/File.txt"
            );
        }
    }

    #[test]
    fn posix_preserves_backslash_as_legal_filename_character() {
        // Backslash is a legal filename character on POSIX filesystems and must
        // not be treated as a path separator. Case folding is still applied on
        // macOS, which is case-insensitive by default.
        #[cfg(target_os = "macos")]
        {
            assert_eq!(
                path_identity_key(Path::new("/Users/joeyc/my\\file.fig")),
                "/users/joeyc/my\\file.fig"
            );
        }
        #[cfg(target_os = "linux")]
        {
            assert_eq!(
                path_identity_key(Path::new("/Users/joeyc/my\\file.fig")),
                "/Users/joeyc/my\\file.fig"
            );
        }
    }
}
