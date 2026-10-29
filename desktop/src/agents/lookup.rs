use std::collections::BTreeMap;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

// Only inspect known executables. Discovery never launches an agent or reads credentials;
// it runs only OpenPencil's own companions, and only to ask their version.
const EXECUTABLES: &[&str] = &[
    "claude",
    "claude-agent-acp",
    "codex",
    "codex-acp",
    "gemini",
    "openpencil-mcp-http",
    "openpencil-harness",
    "npm",
    "bun",
];

// OpenPencil's own companions, whose installed version must match the app.
const PACKAGES: &[(&str, &str)] = &[
    ("openpencil-mcp-http", "@open-pencil/mcp"),
    ("openpencil-harness", "@open-pencil/harness"),
];

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentLookup {
    executables: BTreeMap<String, Option<String>>,
    /// Versions OpenPencil's companions report for `--version`; `None` when one predates it.
    versions: BTreeMap<String, Option<String>>,
    /// Whether this user can write npm's global package folder; `None` without npm or when npm
    /// does not say where it is. A distribution's Node usually needs administrator rights there.
    npm_global_writable: Option<bool>,
    search_path: String,
}

/// Long enough for a cold Node start, short enough that a companion which ignores the flags
/// and keeps running cannot hold up setup.
const VERSION_TIMEOUT: Duration = Duration::from_secs(5);

/// The version line a companion prints for `--version`, or `None` for anything else.
fn parse_version(output: &str) -> Option<String> {
    let line = output.lines().next()?.trim();
    semver::Version::parse(line).ok().map(|_| line.to_owned())
}

/// Asks one of OpenPencil's own companions for its version. Asking the program reports what
/// actually runs, through npm and bun shims, `.cmd` wrappers on Windows, and version managers.
/// `--help` follows so that a release older than `--version` prints its help and exits; it has
/// no version line, which reads as outdated.
fn companion_version(executable: &Path, search_path: &str, timeout: Duration) -> Option<String> {
    parse_version(&run_for_output(
        executable,
        &["--version", "--help"],
        search_path,
        timeout,
    )?)
}

/// Runs a discovered program without a window and returns what it printed, or `None` when it
/// fails to start or outlives `timeout`.
fn run_for_output(
    executable: &Path,
    args: &[&str],
    search_path: &str,
    timeout: Duration,
) -> Option<String> {
    let mut command = Command::new(executable);
    command
        .args(args)
        .env("PATH", search_path)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    let mut child = command.spawn().ok()?;
    let deadline = Instant::now() + timeout;
    while child.try_wait().ok()?.is_none() {
        if Instant::now() >= deadline {
            let _ = child.kill();
            let _ = child.wait();
            return None;
        }
        std::thread::sleep(Duration::from_millis(25));
    }
    let mut output = String::new();
    child.stdout.take()?.read_to_string(&mut output).ok()?;
    Some(output)
}

/// The folder `npm install --global` writes packages into, below the prefix npm reports.
fn npm_global_packages(prefix: &Path) -> PathBuf {
    if cfg!(windows) {
        prefix.join("node_modules")
    } else {
        prefix.join("lib").join("node_modules")
    }
}

/// The closest folder that exists at or above `path`. npm creates the missing ones, so writing
/// there is what decides whether an install can succeed.
fn nearest_existing(path: &Path) -> Option<&Path> {
    path.ancestors().find(|dir| dir.is_dir())
}

/// Whether this process can create files in `dir`, checked by creating and removing one, since
/// permission bits alone do not account for ownership, ACLs, or read-only mounts.
fn can_write(dir: &Path) -> bool {
    let probe = dir.join(format!(".openpencil-write-check-{}", std::process::id()));
    match std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&probe)
    {
        Ok(_) => {
            let _ = std::fs::remove_file(&probe);
            true
        }
        Err(_) => false,
    }
}

fn npm_global_writable(npm: &Path, search_path: &str, timeout: Duration) -> Option<bool> {
    let output = run_for_output(npm, &["prefix", "--global"], search_path, timeout)?;
    let prefix = output.lines().next()?.trim();
    if prefix.is_empty() {
        return None;
    }
    Some(can_write(nearest_existing(&npm_global_packages(
        Path::new(prefix),
    ))?))
}

fn lookup_with(
    search_path: String,
    resolve: impl Fn(&str) -> Option<PathBuf>,
    version: impl Fn(&Path) -> Option<String>,
    npm_writable: impl Fn(&Path) -> Option<bool>,
) -> AgentLookup {
    let resolved: BTreeMap<&str, Option<PathBuf>> = EXECUTABLES
        .iter()
        .map(|command| (*command, resolve(command)))
        .collect();
    let npm_global_writable = resolved
        .get("npm")
        .cloned()
        .flatten()
        .and_then(|npm| npm_writable(&npm));
    AgentLookup {
        npm_global_writable,
        executables: resolved
            .iter()
            .map(|(command, path)| {
                (
                    (*command).to_owned(),
                    path.as_ref()
                        .map(|path| path.to_string_lossy().into_owned()),
                )
            })
            .collect(),
        versions: PACKAGES
            .iter()
            .map(|(command, package)| {
                let path = resolved.get(command).cloned().flatten();
                ((*package).to_owned(), path.and_then(|path| version(&path)))
            })
            .collect(),
        search_path,
    }
}

#[tauri::command]
pub async fn agent_lookup() -> Result<AgentLookup, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let current = std::env::var("PATH").unwrap_or_default();
        let search_path = super::path::augment_path(&current, &super::path::candidate_dirs());
        let cwd = std::env::current_dir().unwrap_or_else(|_| Path::new("/").to_path_buf());
        lookup_with(
            search_path.clone(),
            |command| which::which_in(command, Some(&search_path), &cwd).ok(),
            |executable| companion_version(executable, &search_path, VERSION_TIMEOUT),
            |npm| npm_global_writable(npm, &search_path, VERSION_TIMEOUT),
        )
    })
    .await
    .map_err(|_| "Could not discover local agents.".to_owned())
}

/// The folder coding agents start in. Starting them in the home folder lets them read its
/// project settings (Codex reads `.codex` there) and, sandboxed, write anywhere in it.
#[tauri::command]
pub fn agent_workspace(app: tauri::AppHandle) -> Result<String, String> {
    use tauri::Manager;
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not find the app data folder: {e}"))?
        .join("agent-workspace");
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Could not create the agent workspace: {e}"))?;
    Ok(dir.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reports_the_adapter_missing_when_only_the_agent_cli_is_installed() {
        let result = lookup_with(
            "/agents/bin".to_owned(),
            |command| match command {
                "claude" | "npm" | "openpencil-mcp-http" => {
                    Some(PathBuf::from("/agents/bin").join(command))
                }
                _ => None,
            },
            |_| Some("0.15.1".to_owned()),
            |_| Some(false),
        );
        assert_eq!(result.npm_global_writable, Some(false));
        assert_eq!(
            result.executables["claude"],
            Some("/agents/bin/claude".to_owned())
        );
        assert_eq!(result.executables["claude-agent-acp"], None);
        assert_eq!(
            result.versions["@open-pencil/mcp"],
            Some("0.15.1".to_owned())
        );
        assert_eq!(result.versions["@open-pencil/harness"], None);
    }

    #[test]
    fn checks_npm_only_when_npm_is_found() {
        let result = lookup_with("/bin".to_owned(), |_| None, |_| None, |_| Some(true));
        assert_eq!(result.npm_global_writable, None);
    }

    #[test]
    fn probes_write_access_to_the_global_package_folder() {
        let prefix = std::env::temp_dir().join(format!("open-pencil-npm-{}", std::process::id()));
        let packages = if cfg!(windows) {
            prefix.join("node_modules")
        } else {
            prefix.join("lib").join("node_modules")
        };
        // A fresh user prefix has no package folder yet; npm creates it, so the prefix decides.
        std::fs::create_dir_all(&prefix).expect("create prefix");
        assert_eq!(npm_global_packages(&prefix), packages);
        assert_eq!(nearest_existing(&packages), Some(prefix.as_path()));
        std::fs::create_dir_all(&packages).expect("create package folder");
        assert_eq!(nearest_existing(&packages), Some(packages.as_path()));
        assert!(can_write(&packages));
        // The probe leaves nothing behind.
        assert_eq!(
            std::fs::read_dir(&packages).expect("read folder").count(),
            0
        );
        assert!(!can_write(&prefix.join("missing")));
        std::fs::remove_dir_all(&prefix).expect("clean up");
    }

    #[test]
    fn reads_only_a_version_line() {
        assert_eq!(parse_version("0.15.1\n"), Some("0.15.1".to_owned()));
        assert_eq!(
            parse_version("1.0.0-beta.2\n"),
            Some("1.0.0-beta.2".to_owned())
        );
        // A release older than `--version` prints its help instead.
        assert_eq!(
            parse_version("openpencil-mcp-http\n\nStart the server."),
            None
        );
        assert_eq!(parse_version("1.2\n"), None);
        assert_eq!(parse_version(""), None);
    }

    #[cfg(unix)]
    fn script(name: &str, body: &str) -> PathBuf {
        use std::os::unix::fs::PermissionsExt;
        let dir = std::env::temp_dir().join(format!("openpencil-agents-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join(name);
        std::fs::write(&path, format!("#!/bin/sh\n{body}\n")).unwrap();
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();
        path
    }

    #[cfg(unix)]
    #[test]
    fn asks_a_companion_for_its_version() {
        let current = script("current", "echo 0.15.1");
        let path = std::env::var("PATH").unwrap_or_default();
        assert_eq!(
            companion_version(&current, &path, VERSION_TIMEOUT),
            Some("0.15.1".to_owned())
        );
    }

    #[cfg(unix)]
    #[test]
    fn stops_a_companion_that_ignores_the_flags() {
        let stuck = script("stuck", "sleep 30");
        let path = std::env::var("PATH").unwrap_or_default();
        let started = Instant::now();
        assert_eq!(
            companion_version(&stuck, &path, Duration::from_millis(200)),
            None
        );
        assert!(started.elapsed() < Duration::from_secs(5));
    }
}
