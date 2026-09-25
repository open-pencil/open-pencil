mod credentials;
mod deep_link;
mod fig_container;
mod fonts;
mod http;
mod menu;
mod menu_events;
#[cfg(target_os = "macos")]
mod window;

use credentials::{
    credential_access_paused, credential_retry_access, credential_read, credential_remove, credential_status, credential_store_availability,
    credential_write,
};
use deep_link::path_matches_suffix;
use fig_container::build_fig_file;
use fonts::{list_system_fonts, load_system_font};
use http::proxy_http_request;
use menu::{install_app_menu, native_menu_checked, set_native_menu_checked};
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
    #[serde(skip_serializing_if = "Option::is_none")]
    node: Option<String>,
    /// Which producer queued this entry: a `openpencil://` link (true) or a file
    /// association / argv path (false). The frontend cannot tell them apart from
    /// the path alone — a canonicalized Windows path is verbatim (`\\?\C:\…`).
    #[serde(rename = "deepLink")]
    deep_link: bool,
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

/// Version of the system WebView engine the app is rendering in, so the
/// startup support gate can name it when the engine is too old. Uses the
/// WebKit bundle version on macOS, the WebKitGTK version on Linux, and the
/// WebView2 runtime version on Windows; `None` when the runtime cannot report it.
#[tauri::command]
fn webview_version() -> Option<String> {
    tauri::webview_version().ok()
}

#[tauri::command]
fn set_recent_files(app: tauri::AppHandle, paths: Vec<String>) -> Result<(), String> {
    install_app_menu(&app, &paths).map_err(|error| error.to_string())
}

/// Name of the MCP entry point installed by `@open-pencil/mcp`.
const MCP_EXECUTABLE: &str = "openpencil-mcp-http";
/// Bound on the directories reported back to the settings diagnostics.
const MAX_REPORTED_SEARCH_DIRS: usize = 12;

/// Directories that commonly hold a globally installed Node/Bun CLI.
///
/// GUI launches inherit launchd's minimal `PATH`, so a package installed by
/// npm, Bun, Volta, or Homebrew can be invisible even though the user's shell
/// finds it. `fix_path_env::fix()` reads the login shell first; these entries
/// cover managers that only modify an interactive rc file.
fn mcp_candidate_dirs() -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = Vec::new();
    if let Some(home) = std::env::var_os("HOME").map(PathBuf::from) {
        dirs.push(home.join(".bun/bin"));
        dirs.push(home.join(".local/bin"));
        dirs.push(home.join(".npm-global/bin"));
        dirs.push(home.join(".volta/bin"));
        dirs.push(home.join("n/bin"));
        dirs.push(home.join(".local/share/mise/shims"));
    }
    #[cfg(target_os = "macos")]
    {
        dirs.push(PathBuf::from("/opt/homebrew/bin"));
        dirs.push(PathBuf::from("/usr/local/bin"));
        dirs.push(PathBuf::from("/opt/local/bin"));
    }
    #[cfg(target_os = "linux")]
    {
        dirs.push(PathBuf::from("/usr/local/bin"));
        dirs.push(PathBuf::from("/home/linuxbrew/.linuxbrew/bin"));
    }
    #[cfg(windows)]
    {
        if let Some(appdata) = std::env::var_os("APPDATA").map(PathBuf::from) {
            dirs.push(appdata.join("npm"));
        }
    }
    dirs
}

fn push_unique_dir(dirs: &mut Vec<String>, dir: String) {
    if !dirs.contains(&dir) {
        dirs.push(dir);
    }
}

/// Existing candidate directories, most specific first, for diagnostics.
fn mcp_search_dirs() -> Vec<PathBuf> {
    mcp_candidate_dirs()
        .into_iter()
        .filter(|dir| dir.is_dir())
        .collect()
}

/// Append candidate directories that the current process `PATH` is missing.
fn augment_path(path: &str, candidates: &[PathBuf]) -> String {
    let mut entries: Vec<PathBuf> = std::env::split_paths(path).collect();
    for candidate in candidates {
        if candidate.is_dir() && !entries.contains(candidate) {
            entries.push(candidate.clone());
        }
    }
    std::env::join_paths(entries)
        .map(|joined| joined.to_string_lossy().into_owned())
        .unwrap_or_else(|_| path.to_string())
}

/// Make globally installed CLIs visible to `which` and to spawned children.
fn augment_mcp_path() {
    let current = std::env::var("PATH").unwrap_or_default();
    let next = augment_path(&current, &mcp_candidate_dirs());
    if next != current {
        std::env::set_var("PATH", next);
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct McpLookup {
    available: bool,
    path: Option<String>,
    /// Existing directories that were searched, for diagnostics.
    searched: Vec<String>,
}

#[tauri::command]
fn mcp_lookup() -> McpLookup {
    let resolved = which::which(MCP_EXECUTABLE).ok();
    let path = resolved.as_ref().map(|p| p.display().to_string());
    let mut searched: Vec<String> = Vec::new();
    if let Some(dir) = resolved.as_ref().and_then(|p| p.parent()) {
        push_unique_dir(&mut searched, dir.display().to_string());
    }
    for dir in mcp_search_dirs() {
        push_unique_dir(&mut searched, dir.display().to_string());
    }
    searched.truncate(MAX_REPORTED_SEARCH_DIRS);
    McpLookup {
        available: resolved.is_some(),
        path,
        searched,
    }
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

fn queue_pending<R: tauri::Runtime>(app: &tauri::AppHandle<R>, files: Vec<PendingOpenFile>) {
    if files.is_empty() {
        return;
    }

    if let Ok(mut pending) = app.state::<PendingOpen>().0.lock() {
        pending.extend(files);
    }

    let _ = app.emit("open-associated-files", ());
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_focus();
    }
}

fn queue_open_paths<R: tauri::Runtime>(app: &tauri::AppHandle<R>, paths: Vec<PathBuf>) {
    let files = paths
        .into_iter()
        .map(|path| {
            let _ = app.fs_scope().allow_file(&path);
            PendingOpenFile {
                path: path.to_string_lossy().into_owned(),
                node: None,
                deep_link: false,
            }
        })
        .collect::<Vec<_>>();

    queue_pending(app, files);
}

/// The scheme filter is load-bearing: on macOS the plugin forwards every
/// `RunEvent::Opened` URL here, including the `file://` URLs of a double-clicked
/// document, which `queue_open_paths` already handles.
///
/// Relative paths from a link are deliberately not passed through
/// `fs_scope().allow_file`: the frontend resolves them against open tabs or the
/// file picker and allows the resolved absolute path there.
fn queue_deep_links<R: tauri::Runtime>(app: &tauri::AppHandle<R>, urls: Vec<url::Url>) {
    let files: Vec<PendingOpenFile> = urls
        .iter()
        .filter(|url| url.scheme() == "openpencil")
        .filter_map(|url| match deep_link::parse_open_url(url) {
            Ok(open) => Some(PendingOpenFile {
                path: open.file,
                node: open.node,
                deep_link: true,
            }),
            Err(error) => {
                eprintln!("[deep-link] refused {url}: {error:?}");
                None
            }
        })
        .collect();

    queue_pending(app, files);
}

fn startup_open_paths() -> Vec<PathBuf> {
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    open_paths_from_args(std::env::args().skip(1).collect(), &cwd)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = fix_path_env::fix();
    augment_mcp_path();

    let mut builder = tauri::Builder::default();

    #[cfg(feature = "native-test")]
    {
        builder = builder.plugin(tauri_plugin_wdio_webdriver::init());
    }

    #[cfg(all(
        any(target_os = "macos", windows, target_os = "linux"),
        not(feature = "native-test")
    ))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            queue_open_paths(app, open_paths_from_args(args, Path::new(&cwd)));
        }));
    }

    builder = builder.plugin(tauri_plugin_deep_link::init());

    builder
        .manage(PendingOpen(Mutex::new(Vec::new())))
        .invoke_handler(tauri::generate_handler![
            build_fig_file,
            credential_read,
            credential_access_paused,
            credential_retry_access,
            credential_remove,
            credential_status,
            credential_store_availability,
            credential_write,
            mcp_lookup,
            path_matches_suffix,
            list_system_fonts,
            load_system_font,
            proxy_http_request,
            set_recent_files,
            native_menu_checked,
            set_native_menu_checked,
            take_pending_open,
            webview_version
        ])
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .on_menu_event(|app, event| {
            handle_menu_event(app, event.id().0.as_str());
        })
        .setup(|app| {
            queue_open_paths(app.handle(), startup_open_paths());

            use tauri_plugin_deep_link::DeepLinkExt;
            // On macOS the plugin turns `RunEvent::Opened` into this callback, so every
            // link that arrives while the app runs is handled here; the cold-start link
            // arrives before this closure and is drained from `current` below. The
            // `Opened` arm further down keeps handling file URLs.
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                queue_deep_links(&handle, event.urls());
            });
            #[cfg(any(windows, target_os = "linux"))]
            {
                if let Err(error) = app.deep_link().register_all() {
                    eprintln!("[deep-link] register_all failed: {error}");
                }
            }
            // Every desktop platform can deliver the launch link before this closure
            // runs, which means before the listener above exists, and the plugin's
            // `deep-link://new-url` emit then reaches nobody:
            //
            // - Windows / Linux: the link is argv, and the plugin parses it in its own
            //   setup (`handle_cli_arguments`).
            // - macOS: AppKit delivers the GetURL event *before* the app's setup. Traced
            //   on a cold `open openpencil://…`: `RunEvent::Opened` at T+0.085 s, this
            //   closure at T+0.342 s, and `on_open_url` never fired.
            //
            // In all three cases the URL survives only in the plugin's `current`, so it
            // is read here. No link can be queued twice: `RunEvent::Opened` is dispatched
            // on the main thread, the same thread this closure runs on, so a link cannot
            // arrive between the registration above and this read — anything later goes
            // to `on_open_url` and is no longer in `current` by the time it is read.
            if let Ok(Some(urls)) = app.deep_link().get_current() {
                queue_deep_links(app.handle(), urls);
            }

            Ok(install_app_menu(app.handle(), &[])?)
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, event| match event {
            tauri::RunEvent::ExitRequested {
                api, code: None, ..
            } if !_app.webview_windows().is_empty() => {
                api.prevent_exit();
                // The frontend asks about unsaved documents and exits when they agree.
                let _ = _app.emit("menu-event", "quit");
            }
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
    use super::*;

    #[test]
    fn augment_path_appends_missing_candidates_once() {
        let current_dir = std::env::temp_dir();
        let appended_dir = std::env::temp_dir().join("open-pencil-appended");
        std::fs::create_dir_all(&appended_dir).expect("create candidate dir");

        let current =
            std::env::join_paths([PathBuf::from("/open-pencil-first"), current_dir.clone()])
                .expect("join path list");
        let candidates = vec![current_dir.clone(), appended_dir.clone()];
        let entries: Vec<PathBuf> =
            std::env::split_paths(&augment_path(&current.to_string_lossy(), &candidates)).collect();

        // Existing entries keep their order and the missing candidate is
        // appended once, at the end.
        assert_eq!(
            entries,
            vec![
                PathBuf::from("/open-pencil-first"),
                current_dir,
                appended_dir.clone(),
            ]
        );

        let _ = std::fs::remove_dir(&appended_dir);
    }

    #[test]
    fn augment_path_ignores_candidates_that_do_not_exist() {
        let current =
            std::env::join_paths([PathBuf::from("/open-pencil-only")]).expect("join path list");
        let augmented = augment_path(
            &current.to_string_lossy(),
            &[PathBuf::from("/open-pencil-nonexistent")],
        );

        assert!(!augmented.contains("nonexistent"));
    }

    #[test]
    fn augment_path_keeps_an_existing_path_when_nothing_changes() {
        let current = std::env::var("PATH").unwrap_or_default();
        let augmented = augment_path(&current, &[]);
        assert_eq!(augmented, current);
    }
}
