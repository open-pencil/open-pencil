//! Renders a web page in a hidden webview, so the scripts that build it run, then reads back the
//! document they built. The webview is incognito and has no capability; Tauri lets a remote origin
//! call no command without one, so the page reaches nothing of the app's. Pop-ups, downloads, and
//! navigation away from the web are refused.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use std::time::{Duration, Instant};

use tauri::webview::{NewWindowResponse, PageLoadEvent};
use tauri::{AppHandle, Runtime, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tokio::sync::oneshot;

/// The longest a page may take to load and settle before it is read as it stands.
const RENDER_LIMIT: Duration = Duration::from_secs(30);
/// How often a loaded page is asked whether it has settled.
const POLL_INTERVAL: Duration = Duration::from_millis(200);
/// How long a loaded page must go without a change to its document or a finished request to count
/// as built: long enough for a page to fetch its data and render it after it loads.
const QUIET_PERIOD: Duration = Duration::from_millis(1000);
/// How long one script may take to answer before the page counts as unresponsive.
const SCRIPT_LIMIT: Duration = Duration::from_secs(10);

static NEXT_RENDER: AtomicU64 = AtomicU64::new(0);

/// The renders under way by the id the app gave each, and how to cancel each one.
static RENDERS: LazyLock<Mutex<HashMap<String, oneshot::Sender<()>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderRequest {
    /// Names the render, so `cancel_web_page_render` can stop it.
    id: String,
    url: String,
    width: f64,
    height: f64,
    /// Answers `{ ready, changes }`: whether the page has loaded with its fonts, and how much
    /// activity it has had, changes to its document and finished requests.
    settle_script: String,
    /// Answers the snapshot the app imports.
    snapshot_script: String,
}

#[derive(Debug, serde::Deserialize)]
struct Settling {
    ready: bool,
    changes: u64,
    /// Tells one document from the next, as a page that navigates becomes another.
    document: f64,
}

fn is_web(url: &Url) -> bool {
    matches!(url.scheme(), "http" | "https")
}

/// Runs `script` in the page and parses what it returns, or fails when it does not answer within
/// `limit`.
async fn evaluate<R: Runtime>(
    window: &WebviewWindow<R>,
    script: &str,
    limit: Duration,
) -> Result<serde_json::Value, String> {
    let (sender, receiver) = oneshot::channel::<String>();
    let sender = Mutex::new(Some(sender));
    window
        .eval_with_callback(script, move |result| {
            if let Some(sender) = sender.lock().ok().and_then(|mut slot| slot.take()) {
                let _ = sender.send(result);
            }
        })
        .map_err(|e| e.to_string())?;
    let answer = tokio::time::timeout(limit, receiver)
        .await
        .map_err(|_| "The page stopped answering".to_owned())?
        .map_err(|_| "The page closed".to_owned())?;
    serde_json::from_str(&answer).map_err(|e| format!("The page answered unreadably: {e}"))
}

/// Waits until the page has loaded, its fonts with it, and has gone `QUIET_PERIOD` without a change
/// to its document or a finished request, as a page that builds itself has finished, or until
/// `deadline`, when it is read as it stands. A page that navigates starts its quiet period again.
async fn settle<R: Runtime>(window: &WebviewWindow<R>, script: &str, deadline: Instant) {
    let mut last: Option<(f64, u64, Instant)> = None;
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            return;
        }
        let Ok(answer) = evaluate(window, script, remaining.min(SCRIPT_LIMIT)).await else {
            return;
        };
        let Ok(settling) = serde_json::from_value::<Settling>(answer) else {
            return;
        };
        let now = Instant::now();
        match last {
            Some((document, changes, since))
                if document == settling.document && changes == settling.changes =>
            {
                if settling.ready && now.duration_since(since) >= QUIET_PERIOD {
                    return;
                }
            }
            _ => last = Some((settling.document, settling.changes, now)),
        }
        tokio::time::sleep(POLL_INTERVAL.min(remaining)).await;
    }
}

async fn render<R: Runtime>(
    window: &WebviewWindow<R>,
    loaded: oneshot::Receiver<()>,
    request: &RenderRequest,
) -> Result<serde_json::Value, String> {
    let deadline = Instant::now() + RENDER_LIMIT;
    // A page that never finishes loading is still read once the limit passes.
    let _ = tokio::time::timeout(RENDER_LIMIT, loaded).await;
    settle(window, &request.settle_script, deadline).await;
    evaluate(window, &request.snapshot_script, SCRIPT_LIMIT).await
}

/// The hidden webview pages are rendered in, kept for the app's lifetime and reused: a webview
/// closed on macOS leaves its window behind, so one made per render would leave one per render.
/// `loaded` is where the page now loading reports that it has.
struct RenderWindow {
    window: WebviewWindow,
    loaded: Arc<Mutex<Option<oneshot::Sender<()>>>>,
}

/// The render window, once a render has made it; held for the whole of a render, so renders take
/// turns in it.
static RENDER_WINDOW: LazyLock<tokio::sync::Mutex<Option<RenderWindow>>> =
    LazyLock::new(|| tokio::sync::Mutex::new(None));

/// Where the render window goes between renders, so no page runs in it meanwhile.
const BLANK_PAGE: &str = "about:blank";

fn is_blank(url: &Url) -> bool {
    url.scheme() == "about"
}

fn build_render_window(app: &AppHandle) -> tauri::Result<RenderWindow> {
    let loaded = Arc::new(Mutex::new(None::<oneshot::Sender<()>>));
    let reporting = Arc::clone(&loaded);
    let label = format!("web-page-{}", NEXT_RENDER.fetch_add(1, Ordering::Relaxed));
    let blank = Url::parse(BLANK_PAGE).map_err(tauri::Error::InvalidUrl)?;
    let window = WebviewWindowBuilder::new(app, &label, WebviewUrl::External(blank))
        .visible(false)
        .focused(false)
        .skip_taskbar(true)
        .incognito(true)
        // Web pages, and the blank page between them.
        .on_navigation(|url| is_web(url) || is_blank(url))
        .on_new_window(|_, _| NewWindowResponse::Deny)
        .on_download(|_, _| false)
        .on_page_load(move |_, payload| {
            // Only the page being rendered counts, not the blank page left for it.
            if payload.event() == PageLoadEvent::Finished && !is_blank(payload.url()) {
                if let Some(sender) = reporting.lock().ok().and_then(|mut slot| slot.take()) {
                    let _ = sender.send(());
                }
            }
        })
        .build()?;
    Ok(RenderWindow { window, loaded })
}

/// Opens `request.url` in the hidden render webview at the given size, waits for the page to build
/// itself, and returns what `request.snapshot_script` reads from it. The webview is left on a blank
/// page afterwards, with nothing of the page kept.
#[tauri::command]
pub async fn render_web_page(
    app: AppHandle,
    request: RenderRequest,
) -> Result<serde_json::Value, String> {
    let url = Url::parse(&request.url).map_err(|e| format!("Not a web address: {e}"))?;
    if !is_web(&url) {
        return Err("Only web pages can be rendered".to_owned());
    }
    // Registered before the render waits its turn, so a cancel that arrives meanwhile is not lost.
    let (cancel_sender, cancelled) = oneshot::channel::<()>();
    if let Ok(mut renders) = RENDERS.lock() {
        renders.insert(request.id.clone(), cancel_sender);
    }
    let result = tokio::select! {
        result = render_in_window(&app, url, &request) => result,
        _ = cancelled => Err("The render was cancelled".to_owned()),
    };
    forget_render(&request.id);
    // A render cancelled while its page ran leaves the page; the next one, or this, blanks it.
    if let Ok(mut slot) = RENDER_WINDOW.try_lock() {
        if let Some(render_window) = slot.as_ref() {
            if blank(&render_window.window).is_err() {
                *slot = None;
            }
        }
    }
    result
}

/// Leaves the render window on the blank page, with the page's data cleared.
fn blank(window: &WebviewWindow) -> tauri::Result<()> {
    let blank = Url::parse(BLANK_PAGE).map_err(tauri::Error::InvalidUrl)?;
    window.navigate(blank)?;
    window.clear_all_browsing_data()
}

async fn render_in_window(
    app: &AppHandle,
    url: Url,
    request: &RenderRequest,
) -> Result<serde_json::Value, String> {
    let mut slot = RENDER_WINDOW.lock().await;
    if slot.is_none() {
        *slot =
            Some(build_render_window(app).map_err(|e| format!("Could not open the page: {e}"))?);
    }
    let Some(render_window) = slot.as_ref() else {
        return Err("Could not open the page".to_owned());
    };
    let (loaded_sender, loaded) = oneshot::channel::<()>();
    let opened = (|| {
        render_window.window.clear_all_browsing_data()?;
        render_window
            .window
            .set_size(tauri::LogicalSize::new(request.width, request.height))?;
        if let Ok(mut waiting) = render_window.loaded.lock() {
            *waiting = Some(loaded_sender);
        }
        render_window.window.navigate(url)
    })();
    if let Err(error) = opened {
        // A window that no longer answers is made again for the next render.
        *slot = None;
        return Err(format!("Could not open the page: {error}"));
    }
    let result = render(&render_window.window, loaded, request).await;
    if blank(&render_window.window).is_err() {
        *slot = None;
    }
    result
}

/// Drops the cancel channel of the render `id` names, once it has ended or could not start.
fn forget_render(id: &str) {
    if let Ok(mut renders) = RENDERS.lock() {
        renders.remove(id);
    }
}

/// Stops the render `id` names, if it is still under way: its page closes at once, and the render
/// fails.
#[tauri::command]
pub fn cancel_web_page_render(id: String) {
    let sender = RENDERS
        .lock()
        .ok()
        .and_then(|mut renders| renders.remove(&id));
    if let Some(sender) = sender {
        let _ = sender.send(());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_only_web_addresses() {
        assert!(is_web(&Url::parse("https://example.com/").unwrap()));
        assert!(is_web(&Url::parse("http://localhost:3000/app").unwrap()));
        assert!(!is_web(&Url::parse("file:///etc/passwd").unwrap()));
        assert!(!is_web(&Url::parse("tauri://localhost/").unwrap()));
        assert!(!is_web(&Url::parse("javascript:alert(1)").unwrap()));
    }
}
