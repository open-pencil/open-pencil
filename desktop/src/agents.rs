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
    search_path: String,
}

/// Long enough for a cold Node start, short enough that a companion which ignores the flags
/// and keeps running cannot hold up setup.
const VERSION_TIMEOUT: Duration = Duration::from_secs(5);

/// The version line a companion prints for `--version`, or `None` for anything else.
fn parse_version(output: &str) -> Option<String> {
    let line = output.lines().next()?.trim();
    let mut core = line.split(['-', '+']).next()?.split('.');
    let numeric = (0..3).all(|_| {
        core.next()
            .is_some_and(|part| !part.is_empty() && part.bytes().all(|b| b.is_ascii_digit()))
    });
    (numeric && core.next().is_none()).then(|| line.to_owned())
}

/// Asks one of OpenPencil's own companions for its version. Asking the program reports what
/// actually runs, through npm and bun shims, `.cmd` wrappers on Windows, and version managers.
/// `--help` follows so that a release older than `--version` prints its help and exits; it has
/// no version line, which reads as outdated.
fn companion_version(executable: &Path, search_path: &str, timeout: Duration) -> Option<String> {
    let mut command = Command::new(executable);
    command
        .args(["--version", "--help"])
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
    parse_version(&output)
}

fn lookup_with(
    search_path: String,
    resolve: impl Fn(&str) -> Option<PathBuf>,
    version: impl Fn(&Path) -> Option<String>,
) -> AgentLookup {
    let resolved: BTreeMap<&str, Option<PathBuf>> = EXECUTABLES
        .iter()
        .map(|command| (*command, resolve(command)))
        .collect();
    AgentLookup {
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
        let search_path = crate::augment_path(&current, &crate::mcp_candidate_dirs());
        let cwd = std::env::current_dir().unwrap_or_else(|_| Path::new("/").to_path_buf());
        lookup_with(
            search_path.clone(),
            |command| which::which_in(command, Some(&search_path), &cwd).ok(),
            |executable| companion_version(executable, &search_path, VERSION_TIMEOUT),
        )
    })
    .await
    .map_err(|_| "Could not discover local agents.".to_owned())
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
        );
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
