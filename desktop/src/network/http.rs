use reqwest::{
    header::{HeaderMap, HeaderName, HeaderValue},
    Method,
};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::async_runtime::JoinHandle;
use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::Manager;
use tokio::sync::oneshot;

use super::address::{is_public, is_public_url, literal_ip, PublicResolver};

#[derive(Clone, Deserialize, Serialize)]
pub struct ProxyHttpHeader {
    name: String,
    value: String,
}

#[derive(Deserialize)]
pub struct ProxyHttpRequest {
    /// Chosen by the page so it can cancel the request before the head arrives.
    id: String,
    url: String,
    method: Option<String>,
    headers: Option<Vec<ProxyHttpHeader>>,
    body: Option<Vec<u8>>,
    max_response_bytes: Option<usize>,
    follow_redirects: Option<bool>,
    timeout_ms: Option<u64>,
    /// Set when a web page asks for the file, such as a picture or stylesheet of an imported page.
    page_resource: Option<PageResource>,
}

/// The page a requested file belongs to.
#[derive(Deserialize)]
pub struct PageResource {
    /// The page's own address; none for a page opened from a file or pasted, which counts as being
    /// on the internet.
    page_url: Option<String>,
}

/// The most redirects a request follows.
const MAX_REDIRECTS: usize = 5;

/// Status and headers; the body follows on the request's channel.
#[derive(Serialize)]
pub struct ProxyHttpHead {
    status: u16,
    headers: Vec<ProxyHttpHeader>,
    url: String,
}

/// `network` marks failures to reach the server or read from it, which the page
/// reports the way `fetch` does so callers can retry them.
#[derive(Serialize)]
pub struct ProxyHttpError {
    network: bool,
    message: String,
}

impl ProxyHttpError {
    fn request(message: impl Into<String>) -> Self {
        Self {
            network: false,
            message: message.into(),
        }
    }

    fn network(error: reqwest::Error) -> Self {
        Self {
            network: true,
            message: error.to_string(),
        }
    }
}

/// The end of a body on the request's channel; chunks before it are raw bytes.
#[derive(Serialize)]
#[serde(untagged)]
enum ProxyHttpBodyEnd {
    Done { done: bool },
    Error { error: ProxyHttpError },
}

/// Requests in flight, so the page can cancel one, and cancellations that arrived
/// first: Tauri runs `proxy_http_request` on its own task, so `cancel_http_request`
/// can run before the request is registered.
#[derive(Default)]
pub struct ProxyHttpRequests(Mutex<Requests>);

#[derive(Default)]
struct Requests {
    tasks: HashMap<String, JoinHandle<()>>,
    cancelled: HashSet<String>,
}

impl Requests {
    /// Stops a registered request, or refuses it when it registers later.
    fn cancel(&mut self, id: String) {
        match self.tasks.remove(&id) {
            Some(task) => task.abort(),
            None => {
                self.cancelled.insert(id);
            }
        }
    }

    /// Whether a request may start; false once the page cancelled it.
    fn admit(&mut self, id: &str) -> bool {
        !self.cancelled.remove(id)
    }
}

impl ProxyHttpRequests {
    fn requests(&self) -> std::sync::MutexGuard<'_, Requests> {
        self.0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

fn cancelled() -> ProxyHttpError {
    ProxyHttpError::request("The request was cancelled")
}

type HeadResult = Result<ProxyHttpHead, ProxyHttpError>;

fn request_headers(headers: Option<Vec<ProxyHttpHeader>>) -> HeaderMap {
    let mut mapped = HeaderMap::new();
    for header in headers.unwrap_or_default() {
        let Ok(header_name) = HeaderName::from_bytes(header.name.as_bytes()) else {
            continue;
        };
        let Ok(header_value) = HeaderValue::from_str(&header.value) else {
            continue;
        };
        mapped.insert(header_name, header_value);
    }
    mapped
}

fn request_method(method: Option<String>) -> Result<Method, ProxyHttpError> {
    let raw = method.unwrap_or_else(|| "GET".into());
    Method::from_bytes(raw.as_bytes()).map_err(|e| ProxyHttpError::request(e.to_string()))
}

/// Whether a request for a page's file may reach only public addresses: when the page is on the
/// internet, or has no web address of its own.
async fn public_only(resource: Option<&PageResource>) -> bool {
    let Some(resource) = resource else {
        return false;
    };
    match resource.page_url.as_deref().map(reqwest::Url::parse) {
        Some(Ok(page)) if matches!(page.scheme(), "http" | "https") => is_public_url(&page).await,
        _ => true,
    }
}

fn redirect_policy(follow: bool, public_only: bool) -> reqwest::redirect::Policy {
    if !follow {
        return reqwest::redirect::Policy::none();
    }
    if !public_only {
        return reqwest::redirect::Policy::limited(MAX_REDIRECTS);
    }
    // Names are checked as they resolve; an address written into the redirect never resolves.
    reqwest::redirect::Policy::custom(|attempt| {
        if attempt.previous().len() >= MAX_REDIRECTS {
            attempt.error("too many redirects")
        } else if literal_ip(attempt.url()).is_some_and(|ip| !is_public(ip)) {
            attempt.error("the page redirected to a private network address")
        } else {
            attempt.follow()
        }
    })
}

async fn send(request: ProxyHttpRequest) -> Result<reqwest::Response, ProxyHttpError> {
    let parsed =
        reqwest::Url::parse(&request.url).map_err(|e| ProxyHttpError::request(e.to_string()))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(ProxyHttpError::request(
            "Only HTTP(S) requests are supported",
        ));
    }
    let public_only = public_only(request.page_resource.as_ref()).await;
    if public_only && literal_ip(&parsed).is_some_and(|ip| !is_public(ip)) {
        return Err(ProxyHttpError::request(
            "A page on the internet cannot load files from a private network address",
        ));
    }

    let mut client = reqwest::Client::builder()
        .redirect(redirect_policy(
            request.follow_redirects.unwrap_or(true),
            public_only,
        ))
        // An idle limit, not a total one: a streamed model response can run for
        // minutes while still delivering bytes. Callers cap the total with timeout_ms.
        .connect_timeout(Duration::from_secs(30))
        .read_timeout(Duration::from_secs(30));
    if public_only {
        // A proxy would resolve names itself, out of the resolver's reach.
        client = client.dns_resolver(Arc::new(PublicResolver)).no_proxy();
    }
    let client = client
        .build()
        .map_err(|e| ProxyHttpError::request(e.to_string()))?;
    let mut builder = client
        .request(request_method(request.method)?, parsed)
        .headers(request_headers(request.headers));
    if let Some(body) = request.body {
        builder = builder.body(body);
    }
    if let Some(timeout_ms) = request.timeout_ms {
        if timeout_ms == 0 {
            return Err(ProxyHttpError::request("timeoutMs must be greater than 0"));
        }
        builder = builder.timeout(Duration::from_millis(timeout_ms));
    }
    builder.send().await.map_err(ProxyHttpError::network)
}

fn size_limit_error() -> ProxyHttpError {
    ProxyHttpError::request("HTTP response exceeds the configured size limit")
}

fn end_body(on_body: &Channel<InvokeResponseBody>, end: ProxyHttpBodyEnd) {
    if let Ok(json) = serde_json::to_string(&end) {
        let _ = on_body.send(InvokeResponseBody::Json(json));
    }
}

async fn run(
    request: ProxyHttpRequest,
    head: oneshot::Sender<HeadResult>,
    on_body: Channel<InvokeResponseBody>,
) {
    let limit = request.max_response_bytes;
    let mut response = match send(request).await {
        Ok(response) => response,
        Err(error) => {
            let _ = head.send(Err(error));
            return;
        }
    };
    if let (Some(limit), Some(content_length)) = (limit, response.content_length()) {
        if content_length > limit as u64 {
            let _ = head.send(Err(size_limit_error()));
            return;
        }
    }
    let headers = response
        .headers()
        .iter()
        .filter_map(|(name, value)| {
            Some(ProxyHttpHeader {
                name: name.as_str().to_owned(),
                value: value.to_str().ok()?.to_owned(),
            })
        })
        .collect();
    let sent = head.send(Ok(ProxyHttpHead {
        status: response.status().as_u16(),
        headers,
        url: response.url().to_string(),
    }));
    if sent.is_err() {
        return;
    }

    let mut received = 0;
    loop {
        match response.chunk().await {
            Ok(Some(chunk)) => {
                received += chunk.len();
                if limit.is_some_and(|limit| received > limit) {
                    end_body(
                        &on_body,
                        ProxyHttpBodyEnd::Error {
                            error: size_limit_error(),
                        },
                    );
                    return;
                }
                if on_body
                    .send(InvokeResponseBody::Raw(chunk.to_vec()))
                    .is_err()
                {
                    return;
                }
            }
            Ok(None) => {
                end_body(&on_body, ProxyHttpBodyEnd::Done { done: true });
                return;
            }
            Err(error) => {
                end_body(
                    &on_body,
                    ProxyHttpBodyEnd::Error {
                        error: ProxyHttpError::network(error),
                    },
                );
                return;
            }
        }
    }
}

/// Sends a request from the native side, out of reach of WebView CORS. Resolves
/// with the head as soon as it arrives and streams the body to `on_body`.
#[tauri::command]
pub async fn proxy_http_request<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    request: ProxyHttpRequest,
    on_body: Channel<InvokeResponseBody>,
) -> HeadResult {
    let id = request.id.clone();
    let (head, head_received) = oneshot::channel();
    {
        // Held while spawning, so the task cannot remove its entry before it exists.
        let state = app.state::<ProxyHttpRequests>();
        let mut requests = state.requests();
        if !requests.admit(&id) {
            return Err(cancelled());
        }
        let task_app = app.clone();
        let task_id = id.clone();
        let task = tauri::async_runtime::spawn(async move {
            run(request, head, on_body).await;
            task_app
                .state::<ProxyHttpRequests>()
                .requests()
                .tasks
                .remove(&task_id);
        });
        if let Some(previous) = requests.tasks.insert(id, task) {
            previous.abort();
        }
    }
    head_received.await.map_err(|_| cancelled())?
}

/// Stops a request and its body stream, closing the connection.
#[tauri::command]
pub fn cancel_http_request(requests: tauri::State<'_, ProxyHttpRequests>, id: String) {
    requests.requests().cancel(id);
}

#[cfg(test)]
mod tests {
    use super::{send, PageResource, ProxyHttpRequest, Requests};
    use std::io::{Read, Write};
    use std::net::TcpListener;

    /// A server on this machine that answers every request with `response`, and its port.
    fn local_server(response: &'static str) -> u16 {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        std::thread::spawn(move || {
            for mut stream in listener.incoming().flatten() {
                let mut buffer = [0; 1024];
                let _ = stream.read(&mut buffer);
                let _ = stream.write_all(response.as_bytes());
            }
        });
        port
    }

    fn get(url: String, page_resource: Option<PageResource>) -> ProxyHttpRequest {
        ProxyHttpRequest {
            id: "test".into(),
            url,
            method: None,
            headers: None,
            body: None,
            max_response_bytes: None,
            follow_redirects: None,
            timeout_ms: Some(5_000),
            page_resource,
        }
    }

    const OK: &str = "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok";

    #[tokio::test]
    async fn a_page_on_the_internet_cannot_load_from_this_machine() {
        let port = local_server(OK);
        let internet_page = || {
            Some(PageResource {
                page_url: Some("https://1.1.1.1/".into()),
            })
        };
        for url in [
            format!("http://127.0.0.1:{port}/"),
            format!("http://localhost:{port}/"),
        ] {
            assert!(
                send(get(url.clone(), internet_page())).await.is_err(),
                "{url}"
            );
            // A pasted page, or one opened from a file, counts as on the internet.
            let pasted = Some(PageResource { page_url: None });
            assert!(send(get(url, pasted)).await.is_err());
        }
    }

    #[tokio::test]
    async fn a_page_on_this_machine_and_the_app_itself_reach_it() {
        let port = local_server(OK);
        let url = format!("http://localhost:{port}/style.css");
        let local_page = Some(PageResource {
            page_url: Some(format!("http://localhost:{port}/")),
        });
        assert_eq!(
            send(get(url.clone(), local_page))
                .await
                .ok()
                .unwrap()
                .status(),
            200
        );
        // The app's own requests, such as a model running on this machine.
        assert_eq!(send(get(url, None)).await.ok().unwrap().status(), 200);
    }

    #[tokio::test]
    async fn a_page_on_the_internet_is_not_redirected_into_the_network() {
        let target = local_server(OK);
        let location: &'static str = Box::leak(
            format!(
                "HTTP/1.1 302 Found\r\nLocation: http://127.0.0.1:{target}/\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
            )
            .into_boxed_str(),
        );
        let redirecting = local_server(location);
        let url = format!("http://127.0.0.1:{redirecting}/");
        // The redirecting server is on this machine too, so the page's own policy is tried on it
        // directly: the app's requests follow the redirect, a page's are stopped.
        let client = |public_only| {
            reqwest::Client::builder()
                .redirect(super::redirect_policy(true, public_only))
                .build()
                .unwrap()
        };
        assert_eq!(client(false).get(&url).send().await.unwrap().status(), 200);
        assert!(client(true).get(&url).send().await.is_err());
    }

    #[test]
    fn a_cancel_before_registration_refuses_the_request() {
        let mut requests = Requests::default();
        requests.cancel("early".into());

        assert!(!requests.admit("early"));
        // The refusal is spent; the id is not refused again.
        assert!(requests.admit("early"));
        assert!(requests.admit("other"));
    }
}
