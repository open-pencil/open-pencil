//! A validated gateway to the `git` binary for the source-control panel.
//!
//! `shell:allow-spawn` pins a whole command line (`desktop/AGENTS.md`), so a `git` entry there
//! would let the webview run any subcommand, including `config` or `-c core.pager=…`. This
//! command takes a repository, an allow-listed subcommand and arguments, validates all three,
//! and never builds a shell string: nothing the frontend sends can reach a shell.

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use serde::Serialize;

/// Subcommands the app may run. Reading repository state comes first; writing is limited to
/// the operations the source-control panel performs.
const ALLOWED_SUBCOMMANDS: &[&str] = &[
    "add",
    "branch",
    "checkout",
    "commit",
    "diff",
    "diff-tree",
    "fetch",
    "log",
    "ls-files",
    "merge",
    "merge-base",
    "pull",
    "push",
    "remote",
    "reset",
    "restore",
    "rev-list",
    "rev-parse",
    "show",
    "stash",
    "status",
    "switch",
    "tag",
];

/// Flags that move git away from the repository it is given, let it run another program, or write a
/// file of its own. They are denied for every subcommand.
const DENIED_FLAGS: &[&str] = &[
    "-c",
    "-C",
    "--config-env",
    "--exec",
    "--git-dir",
    "--namespace",
    "--output",
    "--receive-pack",
    "--super-prefix",
    "--upload-pack",
    "--work-tree",
];

/// Flags that skip the repository's own hooks. `--no-verify` is denied for `commit` so a commit
/// the panel makes always runs them, which is what `commit` reports back on failure.
const DENIED_COMMIT_FLAGS: &[&str] = &["--no-verify", "-n"];

/// A denied flag a subcommand still knows under a safe meaning: `-c` names the branch `switch`
/// creates, and only before the subcommand does it set git's own configuration.
const ALLOWED_SUBCOMMAND_FLAGS: &[(&str, &str)] = &[("switch", "-c")];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRunReport {
    /// Process exit status; git reports failures with non-zero codes and a message on stderr.
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitAvailability {
    pub available: bool,
    pub version: Option<String>,
    pub path: Option<String>,
}

/// Run one allow-listed git subcommand in `repo`.
#[tauri::command]
pub async fn git_run(
    capabilities: tauri::State<'_, crate::capabilities::DesktopCapabilities>,
    repo: String,
    subcommand: String,
    args: Option<Vec<String>>,
) -> Result<GitRunReport, String> {
    capabilities.require_host_processes()?;
    let repo = validate_repo(&repo)?;
    validate_subcommand(&subcommand)?;
    let args = args.unwrap_or_default();
    validate_args(&subcommand, &args)?;

    // Named before the move, so the join error still says which subcommand it was.
    let label = format!("git {subcommand}");
    tauri::async_runtime::spawn_blocking(move || run(&repo, &subcommand, &args))
        .await
        .map_err(|error| format!("{label} could not be joined: {error}"))?
}

/// Report whether `git` is installed, so the panel can explain itself before offering actions.
#[tauri::command]
pub fn git_version(
    capabilities: tauri::State<'_, crate::capabilities::DesktopCapabilities>,
) -> Result<GitAvailability, String> {
    // Asking whether git exists means running it, which a build without host processes may not do.
    capabilities.require_host_processes()?;
    Ok(match which::which("git") {
        Ok(path) => GitAvailability {
            available: true,
            version: read_version(&path),
            path: Some(path.display().to_string()),
        },
        Err(_) => GitAvailability {
            available: false,
            version: None,
            path: None,
        },
    })
}

/// The repository root that holds `folder`, or null when the folder is not inside one.
///
/// Adding a project starts from a folder the person picked, which need not be a repository
/// root, so this cannot go through `git_run`: that command refuses a folder without `.git`.
#[tauri::command]
pub async fn git_repository_root(
    capabilities: tauri::State<'_, crate::capabilities::DesktopCapabilities>,
    folder: String,
) -> Result<Option<String>, String> {
    capabilities.require_host_processes()?;
    let folder = validate_folder(&folder)?;
    tauri::async_runtime::spawn_blocking(move || repository_root(&folder))
        .await
        .map_err(|error| format!("git rev-parse could not be joined: {error}"))?
}

/// A picked folder must be absolute and exist, so git is never asked about a path the app
/// resolved for itself.
fn validate_folder(folder: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(folder);
    if !path.is_absolute() {
        return Err(format!("the folder path must be absolute: {folder}"));
    }
    if !path.is_dir() {
        return Err(format!("the folder path is not a directory: {folder}"));
    }
    Ok(path)
}

/// A folder outside a repository answers null, which is how the caller learns it picked a place
/// that is not versioned.
fn repository_root(folder: &Path) -> Result<Option<String>, String> {
    let report = run(folder, "rev-parse", &["--show-toplevel".to_string()])?;
    if report.code != 0 {
        return Ok(None);
    }
    let root = report.stdout.trim().to_string();
    Ok((!root.is_empty()).then_some(root))
}

fn read_version(git: &Path) -> Option<String> {
    let mut command = Command::new(git);
    command.arg("--version").stdin(Stdio::null());
    crate::process::hide_console_window(&mut command);
    let output = command.output().ok()?;
    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    (!text.is_empty()).then_some(text)
}

fn run(repo: &Path, subcommand: &str, args: &[String]) -> Result<GitRunReport, String> {
    let git = which::which("git").map_err(|_| {
        "git is not installed or not on PATH. Install git and try again.".to_string()
    })?;

    let mut command = Command::new(git);
    command
        .arg(subcommand)
        .args(args)
        .current_dir(repo)
        // A prompt would hang the panel: fail instead and report git's own message.
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_PAGER", "cat")
        .env("GIT_OPTIONAL_LOCKS", "0")
        .stdin(Stdio::null());
    crate::process::hide_console_window(&mut command);
    let output = command
        .output()
        .map_err(|error| format!("git {subcommand} could not start: {error}"))?;

    Ok(GitRunReport {
        code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    })
}

/// A repository is a directory that holds a `.git` directory, or a worktree whose `.git` is a
/// file, and it must be absolute so a relative path can never be resolved against the app.
fn validate_repo(repo: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(repo);
    if !path.is_absolute() {
        return Err(format!("the repository path must be absolute: {repo}"));
    }
    if !path.is_dir() {
        return Err(format!("the repository path is not a directory: {repo}"));
    }
    if !path.join(".git").exists() {
        return Err(format!("no .git in {repo}; open the repository root"));
    }
    Ok(path)
}

fn validate_subcommand(subcommand: &str) -> Result<(), String> {
    if subcommand.starts_with('-') || !ALLOWED_SUBCOMMANDS.contains(&subcommand) {
        return Err(format!("git {subcommand} is not available from the panel"));
    }
    Ok(())
}

fn validate_args(subcommand: &str, args: &[String]) -> Result<(), String> {
    for arg in args {
        if arg.contains('\0') {
            return Err("a git argument contains a null byte".to_string());
        }
        let denied = DENIED_FLAGS
            .iter()
            .any(|flag| matches_flag(arg, flag) && !is_allowed_for(subcommand, flag))
            || (subcommand == "commit"
                && DENIED_COMMIT_FLAGS
                    .iter()
                    .any(|flag| matches_flag(arg, flag)));
        if denied {
            return Err(format!(
                "the git argument {arg} is not available from the panel"
            ));
        }
    }
    Ok(())
}

/// Whether `subcommand` gives a denied flag a meaning the panel may use.
fn is_allowed_for(subcommand: &str, flag: &str) -> bool {
    ALLOWED_SUBCOMMAND_FLAGS
        .iter()
        .any(|(allowed_for, allowed_flag)| *allowed_for == subcommand && *allowed_flag == flag)
}

/// A flag is denied under every spelling git accepts for it. `git fetch --upload-p=sh` runs `sh`:
/// the fetch side resolves an unambiguous prefix of its long options, so the full spelling is not
/// the only way to reach one. A short option may carry its value attached, as `-ccore.pager=sh`
/// sets configuration the way `-c` does.
fn matches_flag(arg: &str, flag: &str) -> bool {
    let name = arg.split('=').next().unwrap_or(arg);
    if name == flag || arg.starts_with(&format!("{flag}=")) {
        return true;
    }
    if flag.starts_with("--") {
        return name.len() > 2 && flag.starts_with(name);
    }
    arg.starts_with(flag)
}

#[cfg(test)]
mod tests {
    use super::{validate_args, validate_folder, validate_subcommand};

    fn args(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| (*value).to_string()).collect()
    }

    #[test]
    fn a_picked_folder_must_be_absolute_and_exist() {
        assert!(validate_folder("relative/folder").is_err());
        assert!(validate_folder("").is_err());
        assert!(validate_folder(&std::env::temp_dir().display().to_string()).is_ok());
    }

    #[test]
    fn rejects_subcommands_outside_the_allow_list() {
        assert!(validate_subcommand("config").is_err());
        assert!(validate_subcommand("daemon").is_err());
        assert!(validate_subcommand("-p").is_err());
        assert!(validate_subcommand("status").is_ok());
        assert!(validate_subcommand("commit").is_ok());
    }

    #[test]
    fn rejects_flags_that_redirect_git_or_run_a_program() {
        assert!(validate_args("log", &args(&["-c", "core.pager=sh"])).is_err());
        assert!(validate_args("fetch", &args(&["--upload-pack=sh"])).is_err());
        assert!(validate_args("status", &args(&["-C", "/tmp"])).is_err());
        assert!(validate_args("diff", &args(&["--stat"])).is_ok());
    }

    #[test]
    fn rejects_the_abbreviations_git_accepts_for_them() {
        // Checked against git: `git fetch --upload-p=sh origin` runs `sh origin`, so the short
        // spelling reaches the same program as the full one.
        assert!(validate_args("fetch", &args(&["--upload-p=sh"])).is_err());
        assert!(validate_args("fetch", &args(&["--upload-pa=sh"])).is_err());
        assert!(validate_args("log", &args(&["--exe=sh"])).is_err());
        // A short option may carry its value: `-ccore.pager=sh` sets configuration as `-c` does.
        assert!(validate_args("log", &args(&["-ccore.pager=sh"])).is_err());
        assert!(validate_args("status", &args(&["-C/tmp"])).is_err());
        // An option that merely starts like a denied one is not touched.
        assert!(validate_args("log", &args(&["--format=%s", "--no-merges"])).is_ok());
        assert!(validate_args("diff", &args(&["--no-color"])).is_ok());
    }

    #[test]
    fn rejects_a_diff_that_writes_a_file_of_its_own() {
        // Checked against git: `git diff --output=<path>` writes the patch to that path, which
        // may sit outside every folder the app is scoped to.
        assert!(validate_args("diff", &args(&["--output=/tmp/x.patch"])).is_err());
        // This git calls `--outp` ambiguous, but the panel does not rest on that.
        assert!(validate_args("diff", &args(&["--outp=/tmp/x.patch"])).is_err());
        assert!(validate_args("log", &args(&["--output", "/tmp/x"])).is_err());
        assert!(validate_args("diff", &args(&["--stat"])).is_ok());
    }

    #[test]
    fn a_branch_is_created_with_the_switch_flag() {
        assert!(validate_args("switch", &args(&["-c", "feature/pricing"])).is_ok());
        assert!(validate_args("switch", &args(&["main"])).is_ok());
        // Only `switch` gives `-c` its safe meaning: everywhere else it still sets config.
        assert!(validate_args("commit", &args(&["-c", "core.pager=sh"])).is_err());
        assert!(validate_args("branch", &args(&["-c", "old", "new"])).is_err());
    }

    #[test]
    fn rejects_skipping_hooks_on_commit_but_keeps_them_for_log() {
        assert!(validate_args("commit", &args(&["-m", "x", "--no-verify"])).is_err());
        assert!(validate_args("commit", &args(&["-m", "x"])).is_ok());
        assert!(validate_args("log", &args(&["-n", "5"])).is_ok());
    }
}
