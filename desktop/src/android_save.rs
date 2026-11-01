//! Saving to a document the user chose through Android's "save as" sheet.
//!
//! `ACTION_CREATE_DOCUMENT` returns a `content://` URI. Everything else in the app writes
//! through `std::fs`, which only understands paths, so the bytes have to be handed to the
//! platform's ContentResolver. That lives in Kotlin (`SavePlugin`); this module is the
//! bridge that lets a normal Tauri command call it.

use tauri::plugin::{PluginApi, PluginHandle};
use tauri::Runtime;

/// Package name of the Kotlin plugin class, as registered on the Android side.
#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "net.dannote.open_pencil";

/// Returned when a command is reached on a platform that has no content URIs.
const UNSUPPORTED: &str = "writing to a content URI is only supported on Android";

/// Handle to the Android plugin, kept in Tauri's state so commands can reach it.
pub struct SaveBridge<R: Runtime>(#[allow(dead_code)] PluginHandle<R>);

#[cfg(target_os = "android")]
pub fn init<R: Runtime>(api: &PluginApi<R, ()>) -> Result<SaveBridge<R>, String> {
    api.register_android_plugin(PLUGIN_IDENTIFIER, "SavePlugin")
        .map(SaveBridge)
        .map_err(|error| error.to_string())
}

#[cfg(target_os = "android")]
#[derive(serde::Serialize)]
struct UriArgs<'a> {
    uri: &'a str,
}

#[cfg(target_os = "android")]
#[derive(serde::Deserialize)]
struct DocumentName {
    name: String,
}

impl<R: Runtime> SaveBridge<R> {
    /// Copies `source_path` into `uri`, a `content://` document the user picked.
    #[cfg(target_os = "android")]
    pub fn copy_to_uri(&self, uri: &str, source_path: &str) -> Result<(), String> {
        #[derive(serde::Serialize)]
        struct Args<'a> {
            uri: &'a str,
            #[serde(rename = "sourcePath")]
            source_path: &'a str,
        }

        self.0
            .run_mobile_plugin::<serde_json::Value>(
                "copyToUri",
                Args {
                    uri,
                    source_path,
                },
            )
            .map(|_| ())
            .map_err(|error| error.to_string())
    }

    /// The name the picked document has in its provider, such as `Final.fig`.
    #[cfg(target_os = "android")]
    pub fn document_name(&self, uri: &str) -> Result<String, String> {
        self.0
            .run_mobile_plugin::<DocumentName>("displayName", UriArgs { uri })
            .map(|payload| payload.name)
            .map_err(|error| error.to_string())
    }

    /// Desktop has no content URIs; the commands are registered everywhere so the handler
    /// table stays identical across targets.
    #[cfg(not(target_os = "android"))]
    pub fn copy_to_uri(&self, _uri: &str, _source_path: &str) -> Result<(), String> {
        Err(UNSUPPORTED.into())
    }

    #[cfg(not(target_os = "android"))]
    pub fn document_name(&self, _uri: &str) -> Result<String, String> {
        Err(UNSUPPORTED.into())
    }
}

/// The bridge is only managed on Android. Looking it up for a command that is registered on
/// every target must answer with the unsupported-platform error, not panic.
fn bridge(app: &tauri::AppHandle) -> Result<tauri::State<'_, SaveBridge<tauri::Wry>>, String> {
    use tauri::Manager;

    app.try_state::<SaveBridge<tauri::Wry>>()
        .ok_or_else(|| UNSUPPORTED.to_string())
}

/// Writes a file the webview staged in the cache directory into a `content://` document.
///
/// The webview never sends the bytes: a large design file over the IPC bridge is slow and
/// memory-hungry on a device, so the frontend writes the cache file with the fs plugin and
/// only the path crosses the bridge.
#[tauri::command]
pub fn write_content_uri(
    app: tauri::AppHandle,
    uri: String,
    source_path: String,
) -> Result<(), String> {
    bridge(&app)?.copy_to_uri(&uri, &source_path)
}

/// Reads the display name of a `content://` document the user picked in the save sheet.
#[tauri::command]
pub fn content_uri_display_name(app: tauri::AppHandle, uri: String) -> Result<String, String> {
    bridge(&app)?.document_name(&uri)
}
