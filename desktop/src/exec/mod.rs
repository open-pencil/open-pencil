//! A validated gateway to one allow-listed program for the source-control panel.
//!
//! The panel opens a pull request with the GitHub CLI, so this command runs `gh` and nothing else:
//! the program, its working directory, and its arguments are all checked here, and nothing the
//! frontend sends can reach a shell. `gh` reads its own token from the person's machine, so the
//! app never holds a credential of its own.

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use serde::Serialize;

/// The programs the panel may run. A new one is a deliberate addition, not an argument.
const ALLOWED_PROGRAMS: &[&str] = &["gh"];

/// The longest argument the panel may send; a pull-request body is the longest thing it builds.
const MAX_ARGUMENT_LENGTH: usize = 8000;

/// The most arguments one call may carry.
const MAX_ARGUMENTS: usize = 32;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgramReport {
    /// Process exit status; a program that fails reports a non-zero code and a message on stderr.
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
}

/// Run one allow-listed program in `cwd` and answer what it printed.
#[tauri::command]
pub async fn run_program(
    capabilities: tauri::State<'_, crate::capabilities::DesktopCapabilities>,
    program: String,
    args: Option<Vec<String>>,
    cwd: String,
) -> Result<ProgramReport, String> {
    capabilities.require_host_processes()?;
    let program = validate_program(&program)?;
    let folder = validate_folder(&cwd)?;
    let args = args.unwrap_or_default();
    validate_args(&args)?;

    let label = program.clone();
    tauri::async_runtime::spawn_blocking(move || run(&program, &folder, &args))
        .await
        .map_err(|error| format!("{label} could not be joined: {error}"))?
}

/// A folder the program runs in must be absolute and exist, so it never runs somewhere else.
fn validate_folder(cwd: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(cwd);
    if !path.is_absolute() {
        return Err(format!("the working folder must be absolute: {cwd}"));
    }
    if !path.is_dir() {
        return Err(format!("the working folder is not a directory: {cwd}"));
    }
    Ok(path)
}

/// The program is one the panel knows, never a path the frontend assembled.
fn validate_program(program: &str) -> Result<String, String> {
    let trimmed = program.trim();
    if !ALLOWED_PROGRAMS.contains(&trimmed) {
        return Err(format!("{trimmed} is not available from the panel"));
    }
    Ok(trimmed.to_owned())
}

fn validate_args(args: &[String]) -> Result<(), String> {
    if args.len() > MAX_ARGUMENTS {
        return Err("too many arguments for one call".to_owned());
    }
    for arg in args {
        if arg.contains('\0') {
            return Err("an argument contains a null byte".to_owned());
        }
        if arg.len() > MAX_ARGUMENT_LENGTH {
            return Err("an argument is too long".to_owned());
        }
    }
    Ok(())
}

fn run(program: &str, cwd: &Path, args: &[String]) -> Result<ProgramReport, String> {
    let binary = which::which(program).map_err(|_| {
        format!("{program} is not installed or not on PATH. Install it and try again.")
    })?;

    let mut command = Command::new(binary);
    command
        .args(args)
        .current_dir(cwd)
        // A prompt would hang the panel: fail instead and report the program's own message.
        .env("GH_PROMPT_DISABLED", "1")
        .env("GH_PAGER", "cat")
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("NO_COLOR", "1")
        .stdin(Stdio::null());
    crate::process::hide_console_window(&mut command);
    let output = command
        .output()
        .map_err(|error| format!("{program} could not start: {error}"))?;

    Ok(ProgramReport {
        code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    })
}

#[cfg(test)]
mod tests {
    use super::{validate_args, validate_folder, validate_program};

    fn args(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| (*value).to_owned()).collect()
    }

    #[test]
    fn only_the_allowed_programs_run() {
        assert!(validate_program("gh").is_ok());
        assert!(validate_program("git").is_err());
        assert!(validate_program("sh").is_err());
        assert!(validate_program("").is_err());
    }

    #[test]
    fn a_working_folder_must_be_absolute_and_exist() {
        assert!(validate_folder("relative").is_err());
        assert!(validate_folder("").is_err());
        assert!(validate_folder(&std::env::temp_dir().display().to_string()).is_ok());
    }

    #[test]
    fn arguments_are_bounded_and_free_of_null_bytes() {
        assert!(validate_args(&args(&["pr", "create", "--title", "x"])).is_ok());
        assert!(validate_args(&args(&["pr\0create"])).is_err());
        assert!(validate_args(&["x".repeat(9000)]).is_err());
    }
}
