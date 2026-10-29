//! Everything that asks the app to open something: file associations, launch arguments, and
//! `openpencil://` links, queued until the frontend takes them.

pub mod args;
pub mod links;
pub mod paths;

use std::path::PathBuf;
use std::sync::Mutex;

use tauri::{Emitter, Manager};
use tauri_plugin_fs::FsExt;

#[derive(Clone, serde::Serialize)]
pub struct PendingOpenFile {
    path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    node: Option<String>,
    /// Which producer queued this entry: a `openpencil://` link (true) or a file
    /// association / argv path (false). The frontend cannot tell them apart from
    /// the path alone — a canonicalized Windows path is verbatim (`\\?\C:\…`).
    #[serde(rename = "deepLink")]
    deep_link: bool,
}

#[derive(Default)]
pub struct PendingOpen(Mutex<Vec<PendingOpenFile>>);

/// Rooms from `openpencil://join` links, waiting for the frontend to open them.
#[derive(Default)]
pub struct PendingRooms(Mutex<Vec<String>>);

/// Cloud invitations and shared links from `openpencil://cloud` links, waiting for the frontend.
#[derive(Default)]
pub struct PendingCloudLinks(Mutex<Vec<links::CloudLink>>);

#[tauri::command]
pub fn take_pending_cloud_links(state: tauri::State<PendingCloudLinks>) -> Vec<links::CloudLink> {
    state
        .0
        .lock()
        .map(|mut pending| pending.drain(..).collect())
        .unwrap_or_default()
}

/// Native-test builds take a link through the same path a launch or an opened URL does.
#[cfg(feature = "native-test")]
#[tauri::command]
pub fn native_test_open_deep_link(app: tauri::AppHandle, url: String) -> Result<(), String> {
    let url = url::Url::parse(&url).map_err(|error| error.to_string())?;
    queue_deep_links(&app, vec![url]);
    Ok(())
}

#[tauri::command]
pub fn take_pending_rooms(state: tauri::State<PendingRooms>) -> Vec<String> {
    state
        .0
        .lock()
        .map(|mut pending| pending.drain(..).collect())
        .unwrap_or_default()
}

#[tauri::command]
pub fn take_pending_open(state: tauri::State<PendingOpen>) -> Vec<PendingOpenFile> {
    state
        .0
        .lock()
        .map(|mut pending| pending.drain(..).collect())
        .unwrap_or_default()
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

pub fn queue_open_paths<R: tauri::Runtime>(app: &tauri::AppHandle<R>, paths: Vec<PathBuf>) {
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
pub fn queue_deep_links<R: tauri::Runtime>(app: &tauri::AppHandle<R>, urls: Vec<url::Url>) {
    let mut files = Vec::new();
    let mut rooms = Vec::new();
    let mut cloud_links = Vec::new();
    for url in urls.iter().filter(|url| url.scheme() == "openpencil") {
        match links::parse_deep_link(url) {
            Ok(links::DeepLink::Open(open)) => files.push(PendingOpenFile {
                path: open.file,
                node: open.node,
                deep_link: true,
            }),
            Ok(links::DeepLink::Join(join)) => rooms.push(join.room),
            Ok(links::DeepLink::Cloud(link)) => cloud_links.push(link),
            // The sign-in that opened the browser is waiting; it checks the state itself.
            Ok(links::DeepLink::OAuth(callback)) => {
                let _ = app.emit("oauth-callback", callback);
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_focus();
                }
            }
            // Cloud links carry a secret in the fragment, so a refused link is not echoed.
            Err(error) => eprintln!(
                "[deep-link] refused {}: {error:?}",
                url.host_str().unwrap_or("")
            ),
        }
    }

    queue_pending(app, files);
    queue_rooms(app, rooms);
    queue_cloud_links(app, cloud_links);
}

fn queue_cloud_links<R: tauri::Runtime>(app: &tauri::AppHandle<R>, links: Vec<links::CloudLink>) {
    if links.is_empty() {
        return;
    }

    if let Ok(mut pending) = app.state::<PendingCloudLinks>().0.lock() {
        pending.extend(links);
    }

    let _ = app.emit("open-cloud-links", ());
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_focus();
    }
}

fn queue_rooms<R: tauri::Runtime>(app: &tauri::AppHandle<R>, rooms: Vec<String>) {
    if rooms.is_empty() {
        return;
    }

    if let Ok(mut pending) = app.state::<PendingRooms>().0.lock() {
        pending.extend(rooms);
    }

    let _ = app.emit("open-room-links", ());
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_focus();
    }
}
