//! A picture of one page of a project's running application, for the drift check.
//!
//! A live frame holds the page in an iframe, and a cross-origin iframe cannot be read by the
//! webview that draws it. The picture is therefore taken outside the app, by a headless
//! Chromium-family browser the machine already has, and only from an address on this machine:
//! a frame shows the dev server its project runs, and nothing else is opened on the person's
//! behalf. The browser is found here, never named by the frontend, and it writes its picture into
//! a folder this command owns and removes.

use std::fs::{self, File};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::Serialize;
use url::{Host, Url};

/// The variable that names a browser this machine keeps somewhere other than a known place.
const BROWSER_VARIABLE: &str = "OPENPENCIL_CAPTURE_BROWSER";

/// The browsers looked up on `PATH` when none sits where its platform installs it.
const BROWSER_NAMES: &[&str] = &[
    "google-chrome",
    "chromium",
    "chromium-browser",
    "microsoft-edge",
    "chrome",
    "msedge",
];

/// A live frame is a screen-sized picture: a smaller side is a thumbnail, a larger one is not a
/// page of a dev server.
const MIN_SIDE: u32 = 64;
const MAX_SIDE: u32 = 4096;

/// How long a page has to load and answer before the picture is given up on.
const CAPTURE_TIMEOUT: Duration = Duration::from_secs(30);

/// The standard alphabet the panel decodes with the browser's own decoder.
const BASE64: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PageShot {
    /// The picture's bytes, base64. The panel hashes them and keeps the digest, never the picture.
    pub bytes: String,
    pub width: u32,
    pub height: u32,
}

/// Take one page's picture at the size a frame shows it.
#[tauri::command]
pub async fn capture_page(
    capabilities: tauri::State<'_, crate::capabilities::DesktopCapabilities>,
    url: String,
    width: u32,
    height: u32,
) -> Result<PageShot, String> {
    // Taking a picture means starting a browser, which a build without host processes may not do.
    capabilities.require_host_processes()?;
    let target = validate_target(&url)?;
    validate_size(width, height)?;
    tauri::async_runtime::spawn_blocking(move || capture(&target, width, height))
        .await
        .map_err(|error| format!("the page capture could not be joined: {error}"))?
}

/// The address a page may be taken from: an http(s) address on this machine.
fn validate_target(raw: &str) -> Result<Url, String> {
    let parsed = Url::parse(raw.trim())
        .map_err(|error| format!("the page address is not a URL: {error}"))?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err(format!(
            "a page is taken over http or https, not {}",
            parsed.scheme()
        ));
    }
    if !is_this_machine(&parsed) {
        return Err(format!(
            "a page is taken from this machine, not from {}",
            parsed.host_str().unwrap_or("an address without a host")
        ));
    }
    Ok(parsed)
}

/// Whether an address belongs to a dev server someone runs here: a loopback address, or the
/// `localhost` name and its subdomains, which a running project answers on.
fn is_this_machine(url: &Url) -> bool {
    match url.host() {
        Some(Host::Domain(name)) => name == "localhost" || name.ends_with(".localhost"),
        Some(Host::Ipv4(address)) => address.is_loopback(),
        Some(Host::Ipv6(address)) => address.is_loopback(),
        None => false,
    }
}

fn validate_size(width: u32, height: u32) -> Result<(), String> {
    if !(MIN_SIDE..=MAX_SIDE).contains(&width) || !(MIN_SIDE..=MAX_SIDE).contains(&height) {
        return Err(format!(
            "a picture is taken between {MIN_SIDE} and {MAX_SIDE} pixels a side, not {width} by {height}"
        ));
    }
    Ok(())
}

fn capture(target: &Url, width: u32, height: u32) -> Result<PageShot, String> {
    let browser = find_browser()?;
    let folder = TempFolder::new()?;
    let picture = folder.path().join("page.png");
    let log = folder.path().join("browser.log");
    let error_log = File::create(&log)
        .map_err(|error| format!("the browser's own log has nowhere to go: {error}"))?;

    let mut child = Command::new(&browser)
        .args(arguments(target, width, height, &picture, folder.path()))
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        // Written to a file rather than a pipe: a browser that talks a lot cannot then wait for
        // someone to read it while the capture waits for the browser.
        .stderr(Stdio::from(error_log))
        .spawn()
        .map_err(|error| format!("{} could not start: {error}", browser.display()))?;

    wait(&mut child, &browser)?;

    let bytes = fs::read(&picture).map_err(|_| did_not_draw(&browser, &log))?;
    Ok(PageShot {
        bytes: base64(&bytes),
        width,
        height,
    })
}

/// The command line that writes one picture and exits. Every flag keeps the browser off the
/// person's own profile, off their extensions, and off the first-run pages.
fn arguments(target: &Url, width: u32, height: u32, picture: &Path, folder: &Path) -> Vec<String> {
    vec![
        "--headless=new".to_owned(),
        "--disable-gpu".to_owned(),
        "--hide-scrollbars".to_owned(),
        "--no-first-run".to_owned(),
        "--no-default-browser-check".to_owned(),
        "--disable-extensions".to_owned(),
        "--disable-background-networking".to_owned(),
        "--force-device-scale-factor=1".to_owned(),
        format!("--window-size={width},{height}"),
        // A page that animates never becomes quiet; the budget settles what it shows first.
        "--virtual-time-budget=5000".to_owned(),
        format!("--user-data-dir={}", folder.join("profile").display()),
        format!("--screenshot={}", picture.display()),
        target.as_str().to_owned(),
    ]
}

/// Wait for the browser to exit, or stop it: a browser that hangs must not hold the panel.
fn wait(child: &mut Child, browser: &Path) -> Result<(), String> {
    let started = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_)) => return Ok(()),
            Ok(None) => {}
            Err(error) => {
                // A browser that cannot be watched is stopped all the same, rather than left to
                // finish a picture nobody is waiting for.
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!(
                    "{} could not be watched: {error}",
                    browser.display()
                ));
            }
        }
        if started.elapsed() > CAPTURE_TIMEOUT {
            let _ = child.kill();
            let _ = child.wait();
            return Err(format!(
                "{} did not finish the picture in {} seconds",
                browser.display(),
                CAPTURE_TIMEOUT.as_secs()
            ));
        }
        std::thread::sleep(Duration::from_millis(100));
    }
}

/// What a browser that exited without a picture said, with the tail of its own words kept.
fn did_not_draw(browser: &Path, log: &Path) -> String {
    let said = fs::read_to_string(log).unwrap_or_default();
    let tail: Vec<&str> = said
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .rev()
        .take(3)
        .collect();
    if tail.is_empty() {
        return format!("{} exited without drawing the page", browser.display());
    }
    let words: Vec<&str> = tail.into_iter().rev().collect();
    format!(
        "{} exited without drawing the page: {}",
        browser.display(),
        words.join(" ")
    )
}

/// The browser that takes the picture: the one a person named, else the first one found where
/// their platform installs it, else the first one on `PATH`.
fn find_browser() -> Result<PathBuf, String> {
    if let Some(named) = browser_from_environment()? {
        return Ok(named);
    }
    for candidate in well_known_browsers() {
        if candidate.is_file() {
            return Ok(candidate);
        }
    }
    for name in BROWSER_NAMES {
        if let Ok(path) = which::which(name) {
            return Ok(path);
        }
    }
    Err(format!(
        "no Chrome, Chromium, or Edge was found to draw the page. Install one, or name it in {BROWSER_VARIABLE}."
    ))
}

fn browser_from_environment() -> Result<Option<PathBuf>, String> {
    let Some(named) = std::env::var_os(BROWSER_VARIABLE) else {
        return Ok(None);
    };
    let path = PathBuf::from(named);
    if path.as_os_str().is_empty() {
        return Ok(None);
    }
    if !path.is_file() {
        return Err(format!(
            "{BROWSER_VARIABLE} names {}, which is not a program",
            path.display()
        ));
    }
    Ok(Some(path))
}

/// Where each platform installs a browser a person is likely to already have.
fn well_known_browsers() -> Vec<PathBuf> {
    #[allow(unused_mut)]
    let mut paths = Vec::new();
    #[cfg(target_os = "windows")]
    {
        for variable in ["ProgramFiles", "ProgramFiles(x86)", "LocalAppData"] {
            let Some(base) = std::env::var_os(variable) else {
                continue;
            };
            let base = PathBuf::from(base);
            paths.push(
                base.join("Google")
                    .join("Chrome")
                    .join("Application")
                    .join("chrome.exe"),
            );
            paths.push(
                base.join("Microsoft")
                    .join("Edge")
                    .join("Application")
                    .join("msedge.exe"),
            );
        }
    }
    #[cfg(target_os = "macos")]
    {
        for (app, binary) in [
            ("Google Chrome", "Google Chrome"),
            ("Chromium", "Chromium"),
            ("Microsoft Edge", "Microsoft Edge"),
        ] {
            paths.push(
                PathBuf::from("/Applications")
                    .join(format!("{app}.app"))
                    .join("Contents")
                    .join("MacOS")
                    .join(binary),
            );
        }
    }
    #[cfg(target_os = "linux")]
    {
        for path in [
            "/usr/bin/google-chrome",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
            "/usr/bin/microsoft-edge",
            "/snap/bin/chromium",
        ] {
            paths.push(PathBuf::from(path));
        }
    }
    paths
}

/// A folder under the system's temporary area, removed however the capture ends.
struct TempFolder {
    path: PathBuf,
}

impl TempFolder {
    fn new() -> Result<Self, String> {
        let base = std::env::temp_dir();
        // A folder that is really this capture's own: `create_dir` fails when the name is taken, so
        // two captures never write one picture over the other's, and the name is a nanosecond stamp
        // with an attempt count rather than a moment anyone can aim at.
        for attempt in 0..100u32 {
            let stamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|elapsed| elapsed.as_nanos())
                .unwrap_or_default();
            let path = base.join(format!(
                "openpencil-capture-{}-{stamp}-{attempt}",
                std::process::id()
            ));
            match fs::create_dir(&path) {
                Ok(()) => {
                    fs::create_dir(path.join("profile")).map_err(|error| {
                        format!("the picture has nowhere to be written: {error}")
                    })?;
                    return Ok(Self { path });
                }
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
                Err(error) => {
                    return Err(format!("the picture has nowhere to be written: {error}"))
                }
            }
        }
        Err("no folder was free for the picture after a hundred tries".to_owned())
    }

    fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for TempFolder {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

/// The bytes as padded standard base64, which is what the panel's decoder takes.
fn base64(bytes: &[u8]) -> String {
    let mut text = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let first = u32::from(chunk[0]);
        let second = chunk.get(1).copied().map(u32::from).unwrap_or_default();
        let third = chunk.get(2).copied().map(u32::from).unwrap_or_default();
        let triple = (first << 16) | (second << 8) | third;
        text.push(BASE64[(triple >> 18) as usize & 63] as char);
        text.push(BASE64[(triple >> 12) as usize & 63] as char);
        text.push(if chunk.len() > 1 {
            BASE64[(triple >> 6) as usize & 63] as char
        } else {
            '='
        });
        text.push(if chunk.len() > 2 {
            BASE64[triple as usize & 63] as char
        } else {
            '='
        });
    }
    text
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use url::Url;

    use super::{arguments, base64, validate_size, validate_target, TempFolder};

    #[test]
    fn only_an_address_on_this_machine_is_taken() {
        for allowed in [
            "http://localhost:3000/pricing",
            "http://127.0.0.1:1420/",
            "https://app.localhost/",
            "http://[::1]:8080/pricing",
        ] {
            assert!(validate_target(allowed).is_ok(), "{allowed} is taken");
        }
        for refused in [
            "http://example.com/",
            "https://10.0.0.1/",
            "file:///etc/passwd",
            "javascript:alert(1)",
            "not a url",
        ] {
            assert!(validate_target(refused).is_err(), "{refused} is refused");
        }
    }

    #[test]
    fn a_picture_is_taken_at_a_frame_size() {
        assert!(validate_size(1440, 900).is_ok());
        assert!(validate_size(64, 4096).is_ok());
        assert!(validate_size(63, 900).is_err());
        assert!(validate_size(1440, 4097).is_err());
    }

    #[test]
    fn the_picture_travels_as_padded_base64() {
        assert_eq!(base64(b""), "");
        assert_eq!(base64(b"f"), "Zg==");
        assert_eq!(base64(b"fo"), "Zm8=");
        assert_eq!(base64(b"foo"), "Zm9v");
        assert_eq!(base64(b"foob"), "Zm9vYg==");
        assert_eq!(base64(b"fooba"), "Zm9vYmE=");
        assert_eq!(base64(b"foobar"), "Zm9vYmFy");
    }

    #[test]
    fn the_command_line_names_one_picture_and_no_other_profile() {
        let target = Url::parse("http://localhost:3000/pricing").expect("a valid address");
        let args = arguments(
            &target,
            800,
            600,
            Path::new("/tmp/openpencil/page.png"),
            Path::new("/tmp/openpencil"),
        );
        assert!(args.iter().any(|arg| arg == "--headless=new"));
        assert!(args.contains(&"--window-size=800,600".to_owned()));
        assert!(args
            .iter()
            .any(|arg| arg.starts_with("--user-data-dir=/tmp/openpencil")));
        assert!(args
            .iter()
            .any(|arg| arg == "--screenshot=/tmp/openpencil/page.png"));
        assert_eq!(args.last().expect("the address is last"), target.as_str());
    }

    #[test]
    fn two_captures_never_share_a_folder() {
        let first = TempFolder::new().expect("a temp folder of its own");
        let second = TempFolder::new().expect("a temp folder of its own");

        // The name is made for one capture only, and the folder is created exclusively: a second
        // capture either gets another name or fails, never the first one's folder.
        assert_ne!(first.path(), second.path());
        assert!(first.path().join("profile").is_dir());
        assert!(second.path().join("profile").is_dir());
    }
}
