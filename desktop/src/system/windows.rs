//! Windows the app opens for the editor. Only the app creates windows: a window's label decides
//! its capability, so a page that could open one under any label could take another window's
//! permissions.

use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};

/// The Software Update window's label, which `desktop/capabilities/updater.json` names.
const UPDATER: &str = "updater";
const UPDATER_SIZE: (f64, f64) = (560.0, 520.0);

/// Shows the Software Update window, focusing it when it is already open. Asynchronous, as a
/// synchronous command that builds a window deadlocks on Windows.
#[tauri::command]
pub async fn open_updater_window<R: Runtime>(
    app: AppHandle<R>,
    webview: tauri::Webview<R>,
    title: String,
) -> Result<(), String> {
    if webview.label() != "main" {
        return Err("Only the editor opens the Software Update window.".to_owned());
    }
    if let Some(window) = app.get_webview_window(UPDATER) {
        let _ = window.unminimize();
        return window.set_focus().map_err(|e| e.to_string());
    }
    let (width, height) = UPDATER_SIZE;
    // A separate page, so the window never boots the editor.
    WebviewWindowBuilder::new(&app, UPDATER, WebviewUrl::App("updater.html".into()))
        .title(title)
        .inner_size(width, height)
        .min_inner_size(width, height)
        .center()
        .minimizable(false)
        .maximizable(false)
        .disable_drag_drop_handler()
        .focused(true)
        .build()
        .map(|_| ())
        .map_err(|e| e.to_string())
}
