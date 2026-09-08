use std::sync::Mutex;
#[cfg(feature = "native-test")]
use tauri::Manager;
#[cfg(not(feature = "native-test"))]
use tauri_plugin_opener::OpenerExt;

#[cfg(feature = "native-test")]
pub struct OpenedExternalUrls(pub Mutex<Vec<String>>);

#[tauri::command]
pub fn open_external_url<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    url: String,
) -> Result<(), String> {
    #[cfg(feature = "native-test")]
    {
        app.state::<OpenedExternalUrls>()
            .0
            .lock()
            .map_err(|_| "Native test opener state is unavailable".to_owned())?
            .push(url);
        Ok(())
    }

    #[cfg(not(feature = "native-test"))]
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|error| error.to_string())
}

#[cfg(feature = "native-test")]
#[tauri::command]
pub fn take_native_test_opened_urls(
    state: tauri::State<OpenedExternalUrls>,
) -> Result<Vec<String>, String> {
    state
        .0
        .lock()
        .map(|mut urls| urls.drain(..).collect())
        .map_err(|_| "Native test opener state is unavailable".to_owned())
}
