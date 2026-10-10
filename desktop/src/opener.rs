use url::Url;

/// Links the editor sends to the system browser or mail app. Anything else, such as `file:` or
/// another app's scheme, is refused rather than handed to the operating system.
const EXTERNAL_SCHEMES: [&str; 3] = ["http", "https", "mailto"];

fn external_url(url: &str) -> Result<Url, String> {
    let parsed = Url::parse(url).map_err(|_| "The link is not a valid address".to_owned())?;
    if EXTERNAL_SCHEMES.contains(&parsed.scheme()) {
        Ok(parsed)
    } else {
        Err("The link does not open in a browser".to_owned())
    }
}

/// Native-test builds record the links they would open, so a test can read the sign-in address
/// without a browser window opening on the machine running it.
#[cfg(feature = "native-test")]
#[derive(Default)]
pub struct OpenedExternalUrls(pub std::sync::Mutex<Vec<String>>);

#[cfg(not(feature = "native-test"))]
#[tauri::command]
pub fn open_external_url<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    url: String,
) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;

    let url = external_url(&url)?;
    app.opener()
        .open_url(url.as_str(), None::<&str>)
        .map_err(|error| error.to_string())
}

#[cfg(feature = "native-test")]
#[tauri::command]
pub fn open_external_url(
    state: tauri::State<OpenedExternalUrls>,
    url: String,
) -> Result<(), String> {
    let url = external_url(&url)?;
    state
        .0
        .lock()
        .map_err(|_| "Native test opener state is unavailable".to_owned())?
        .push(url.into());
    Ok(())
}

#[cfg(feature = "native-test")]
#[tauri::command]
pub fn take_native_test_opened_urls(state: tauri::State<OpenedExternalUrls>) -> Vec<String> {
    state
        .0
        .lock()
        .map(|mut urls| urls.drain(..).collect())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::external_url;

    #[test]
    fn opens_web_and_mail_links_only() {
        assert!(external_url("https://cloud.example.com/cloud/device?user_code=ABCD").is_ok());
        assert!(external_url("http://192.168.1.20:3000/account").is_ok());
        assert!(external_url("mailto:team@example.com").is_ok());
        for url in [
            "file:///etc/passwd",
            "openpencil://open?file=a.pen",
            "javascript:alert(1)",
            "not a link",
        ] {
            assert!(external_url(url).is_err(), "{url}");
        }
    }
}
