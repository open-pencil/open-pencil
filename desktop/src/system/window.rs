use tauri::Manager;

pub fn show_main_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// WebKit ended the editor's page process, as a crash in its JavaScript engine does: the page
/// loads again, so the window is not left blank and the new page offers the work its recovery
/// copies kept (#1977). Tauri's default handler does nothing when it finds its window table
/// borrowed; this hook is handed the webview itself.
pub fn reload_after_page_process_ended<R: tauri::Runtime>(webview: &tauri::Webview<R>) {
    eprintln!(
        "[webview] the page process of {} ended; reloading",
        webview.label()
    );
    if let Err(error) = webview.reload() {
        eprintln!("[webview] could not reload {}: {error}", webview.label());
    }
}
