//! What the system and environment tell the frontend about where it runs.

/// Version of the system WebView engine the app is rendering in, so the
/// startup support gate can name it when the engine is too old. Uses the
/// WebKit bundle version on macOS, the WebKitGTK version on Linux, and the
/// WebView2 runtime version on Windows; `None` when the runtime cannot report it.
#[tauri::command]
pub fn webview_version() -> Option<String> {
    tauri::webview_version().ok()
}

/// Whether the environment turns off pings and usage stats: `OPENPENCIL_TELEMETRY` set to
/// `0`, `false`, or `no`, or `DO_NOT_TRACK` set to anything but `0` or `false`.
#[tauri::command]
pub fn sharing_disabled_by_env() -> bool {
    let is_off = |name: &str, off: &[&str]| {
        std::env::var(name)
            .map(|value| off.contains(&value.trim().to_ascii_lowercase().as_str()))
            .unwrap_or(false)
    };
    let do_not_track = std::env::var("DO_NOT_TRACK")
        .map(|value| {
            !matches!(
                value.trim().to_ascii_lowercase().as_str(),
                "" | "0" | "false"
            )
        })
        .unwrap_or(false);
    is_off("OPENPENCIL_TELEMETRY", &["0", "false", "no"]) || do_not_track
}
