//! Everything that asks the app to open something: file associations, launch arguments, and
//! `openpencil://` links, queued until the frontend takes them.

pub mod args;
pub mod links;
pub mod paths;

use std::path::{Path, PathBuf};
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

/// The design-document extensions the frontend opens (`io.findReader` plus the DOM
/// documents `openFileFromPath` accepts). The command below allow-lists one such file
/// and nothing else, so a caller cannot use it to reach an executable or a secret file.
const OPENABLE_DOCUMENT_EXTENSIONS: [&str; 10] = [
    "fig", "jam", "pen", "drawio", "dio", "mmd", "mermaid", "html", "htm", "xhtml",
];

fn is_openable_document(path: &Path) -> bool {
    // draw.io embeds its diagram in PNG/SVG exports (`flow.drawio.png`); those are
    // supported editable documents, not arbitrary images.
    if path
        .file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| {
            let lower = name.to_lowercase();
            lower.ends_with(".drawio.png") || lower.ends_with(".drawio.svg")
        })
    {
        return true;
    }
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            OPENABLE_DOCUMENT_EXTENSIONS
                .iter()
                .any(|allowed| allowed.eq_ignore_ascii_case(extension))
        })
}

/// Read the one design document the frontend was explicitly asked to open, natively.
///
/// Files handed to the executable are allow-listed by `queue_open_paths` before the
/// frontend sees them, but a file automation names (`open_document`) or a recent file
/// reaches the frontend with no such call, so a path the fs scope does not already
/// cover is refused as a forbidden path. That includes every hidden folder:
/// `requireLiteralLeadingDot` keeps `**` from matching a dot segment, so
/// `%USERPROFILE%\.pencil\documents\…` never matches the read scope even though it
/// sits under the user's home.
///
/// The read happens here, in the shell, instead of granting the webview access to
/// the file: adding the path to the shared fs scope would also let the webview write
/// it (the fs plugin uses the same scope for writes), reopening the hidden-file
/// write path the desktop guidelines require to stay closed. This command only
/// returns the bytes and never touches `fs_scope()`, so a file that was never opened
/// stays refused for writing.
///
/// Only the editor window may call it: the updater webview owns no documents, so a
/// script running in it must not reach document reads. The read runs on a blocking
/// thread, since a document on a slow network share must not stall the desktop
/// event loop, and the bytes cross IPC as a raw body rather than a JSON number
/// array, so large documents do not pay decimal encoding and parsing per byte.
#[tauri::command]
pub async fn read_open_file(
    webview: tauri::Webview,
    path: String,
) -> Result<tauri::ipc::Response, String> {
    if webview.label() != "main" {
        return Err("read_open_file is only available to the editor window".into());
    }
    let path = PathBuf::from(path);
    if !is_openable_document(&path) {
        return Err(format!(
            "Only design documents can be opened: {}",
            path.display()
        ));
    }
    let bytes = tauri::async_runtime::spawn_blocking(move || {
        std::fs::read(&path).map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())??;
    Ok(tauri::ipc::Response::new(bytes))
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_open_file_accepts_the_documents_the_frontend_opens() {
        for name in [
            "design.fig",
            "board.jam",
            "design.pen",
            "diagram.drawio",
            "diagram.dio",
            "notes.mmd",
            "notes.mermaid",
            "page.html",
            "page.htm",
            "page.xhtml",
        ] {
            assert!(
                is_openable_document(Path::new(name)),
                "{name} should be openable"
            );
        }
        // Case follows the filesystem: the frontend's check lowercases the name.
        assert!(is_openable_document(Path::new("DESIGN.FIG")));
        assert!(is_openable_document(Path::new(
            "C:\\Users\\ada\\.pencil\\documents\\abc\\design.pen"
        )));
    }

    #[test]
    fn is_openable_document_accepts_drawio_exports() {
        // A draw.io export embeds its diagram in the PNG/SVG, so the compound suffix
        // names a supported document even though the final extension alone does not.
        for name in ["flow.drawio.png", "flow.drawio.svg", "FLOW.DRAWIO.PNG"] {
            assert!(
                is_openable_document(Path::new(name)),
                "{name} should be openable"
            );
        }
    }

    #[test]
    fn read_open_file_refuses_anything_that_is_not_a_design_document() {
        for name in [
            "notes.txt",
            "run.sh",
            "run.exe",
            "id_ed25519",
            "settings.json",
            ".bashrc",
            "design",
            "design.fig.bak",
            // Plain images are not documents, even with a draw.io-looking name.
            "photo.png",
            "diagram.svg",
            "flow.png",
        ] {
            assert!(
                !is_openable_document(Path::new(name)),
                "{name} should not be openable"
            );
        }
    }
}
