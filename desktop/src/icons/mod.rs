//! Tauri commands that draw SF Symbols as outlines. Apple licenses the symbols for use on its
//! own platforms, so they are drawn by the Mac the app runs on, never bundled or served.

#[cfg(target_os = "macos")]
mod sf_symbols;

/// The SF Symbols this Mac draws, as JSON, or nothing where they cannot be drawn as outlines.
#[tauri::command]
pub async fn sf_symbols_catalogue() -> Option<String> {
    #[cfg(target_os = "macos")]
    return tauri::async_runtime::spawn_blocking(sf_symbols::catalogue)
        .await
        .ok()
        .flatten();
    #[cfg(not(target_os = "macos"))]
    None
}

/// The symbols a JSON request names, drawn as it asks, as JSON. Not async, so Tauri runs it on
/// the main thread, which SwiftUI draws on.
#[tauri::command]
pub fn sf_symbols_render(request: String) -> Option<String> {
    #[cfg(target_os = "macos")]
    return sf_symbols::render(&request);
    #[cfg(not(target_os = "macos"))]
    {
        let _ = request;
        None
    }
}
