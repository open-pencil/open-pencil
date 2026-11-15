use tauri::Emitter;

#[cfg(debug_assertions)]
use tauri::Manager;

pub fn handle_menu_event<R: tauri::Runtime>(app: &tauri::AppHandle<R>, event_id: &str) {
    #[cfg(debug_assertions)]
    if event_id == "dev-tools" {
        if let Some(window) = app.get_webview_window("main") {
            if window.is_devtools_open() {
                window.close_devtools();
            } else {
                window.open_devtools();
            }
        }
        return;
    }
    let _ = app.emit("menu-event", event_id);
}
