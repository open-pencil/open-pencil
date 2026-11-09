//! Starting the application a project holds.
//!
//! A project's start command comes from its manifest, so it cannot be pinned in
//! `shell:allow-spawn` (`desktop/AGENTS.md`): this command runs it in the folder the application
//! lives in, with that folder's own `node_modules/.bin` ahead of the path the way a package script
//! sees it, and forwards what it prints to the window that started it.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

/// A line longer than this is cut, so a runaway program cannot fill the window's memory.
const MAX_LINE_LENGTH: usize = 2000;
/// The longest start command a project may hold: a package script, not a program of its own.
const MAX_COMMAND_LENGTH: usize = 2000;

/// The processes the app started, by project: a second start replaces the first, and leaving the
/// app stops them all.
#[derive(Default)]
pub struct RunnerState(pub Arc<Mutex<HashMap<String, u32>>>);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OutputPayload {
    id: String,
    line: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExitPayload {
    id: String,
    code: Option<i32>,
}

/// Start the command a project names, in the folder its application lives in, and answer its
/// process id. What it prints arrives as `project-output`, and its exit as `project-exit`.
#[tauri::command]
pub async fn project_start<R: tauri::Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, RunnerState>,
    id: String,
    directory: String,
    command: String,
) -> Result<u32, String> {
    let folder = validate_folder(&directory)?;
    let command = validate_command(&command)?;
    let processes = Arc::clone(&state.0);

    // One run per project: a second start replaces the first rather than stacking servers.
    stop(&processes, &id);

    let mut child = spawn(&folder, &command)?;
    let pid = child.id();
    if let Some(stdout) = child.stdout.take() {
        let window = app.clone();
        let project = id.clone();
        std::thread::spawn(move || forward(window, project, stdout));
    }
    if let Some(stderr) = child.stderr.take() {
        let window = app.clone();
        let project = id.clone();
        std::thread::spawn(move || forward(window, project, stderr));
    }

    let window = app.clone();
    let project = id.clone();
    std::thread::spawn(move || {
        let code = child.wait().ok().and_then(|status| status.code());
        // The entry goes first: a process that already exited must never be killed again, and
        // its id may belong to another process by then.
        if let Ok(mut running) = processes.lock() {
            running.remove(&project);
        }
        let _ = window.emit("project-exit", ExitPayload { id: project, code });
    });

    if let Ok(mut running) = state.0.lock() {
        running.insert(id, pid);
    }
    Ok(pid)
}

/// Stop the application a project started; a project that runs nothing is not an error.
#[tauri::command]
pub fn project_stop(state: tauri::State<'_, RunnerState>, id: String) {
    stop(&state.0, &id);
}

/// The process id of the application a project runs, or null when it runs nothing. A window
/// that reloaded asks this, so its screen shows the run it left rather than an idle project.
#[tauri::command]
pub fn project_run(state: tauri::State<'_, RunnerState>, id: String) -> Option<u32> {
    state
        .0
        .lock()
        .ok()
        .and_then(|running| running.get(&id).copied())
}

/// Stop everything the app started, so quitting never leaves a server behind.
pub fn stop_all<R: tauri::Runtime>(app: &AppHandle<R>) {
    let Some(state) = app.try_state::<RunnerState>() else {
        return;
    };
    let processes = Arc::clone(&state.0);
    let ids: Vec<String> = processes
        .lock()
        .map(|running| running.keys().cloned().collect())
        .unwrap_or_default();
    for id in ids {
        stop(&processes, &id);
    }
}

fn stop(processes: &Arc<Mutex<HashMap<String, u32>>>, id: &str) {
    let pid = processes
        .lock()
        .ok()
        .and_then(|mut running| running.remove(id));
    if let Some(pid) = pid {
        kill_tree(pid);
    }
}

/// A project folder must be absolute and exist, so a command never runs somewhere the app picked.
fn validate_folder(directory: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(directory);
    if !path.is_absolute() {
        return Err(format!("the project path must be absolute: {directory}"));
    }
    if !path.is_dir() {
        return Err(format!("the project path is not a directory: {directory}"));
    }
    Ok(path)
}

/// The command is the manifest's own text, so it may hold anything a shell accepts; it is never
/// built from a path or an argument the frontend assembles.
fn validate_command(command: &str) -> Result<String, String> {
    let command = command.trim();
    if command.is_empty() {
        return Err("the project has no start command".to_owned());
    }
    if command.len() > MAX_COMMAND_LENGTH {
        return Err("the start command is too long".to_owned());
    }
    if command.contains('\0') {
        return Err("the start command contains a null byte".to_owned());
    }
    Ok(command.to_owned())
}

fn spawn(folder: &Path, command: &str) -> Result<Child, String> {
    let mut process = shell(command);
    process
        .current_dir(folder)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    // A package script runs with the project's own binaries ahead of the path; the command read
    // from the manifest must see the same ones.
    let mut paths = vec![folder.join("node_modules").join(".bin")];
    if let Some(path) = std::env::var_os("PATH") {
        paths.extend(std::env::split_paths(&path));
    }
    if let Ok(joined) = std::env::join_paths(paths) {
        process.env("PATH", joined);
    }
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        // Its own group, so stopping it takes the servers it started with it.
        process.process_group(0);
    }
    process
        .spawn()
        .map_err(|error| format!("the application could not start: {error}"))
}

fn shell(command: &str) -> Command {
    #[cfg(windows)]
    {
        let mut process = Command::new("cmd");
        process.arg("/S").arg("/C").arg(command);
        process
    }
    #[cfg(not(windows))]
    {
        let mut process = Command::new("sh");
        process.arg("-c").arg(command);
        process
    }
}

/// Stop a process and everything it started: a package manager holds its server as a child.
fn kill_tree(pid: u32) {
    #[cfg(windows)]
    {
        let _ = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    #[cfg(not(windows))]
    {
        let _ = Command::new("kill")
            .args(["-TERM", &format!("-{pid}")])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
}

fn forward<R: tauri::Runtime>(app: AppHandle<R>, id: String, stream: impl Read + Send + 'static) {
    for line in BufReader::new(stream).lines().map_while(Result::ok) {
        let line = if line.chars().count() > MAX_LINE_LENGTH {
            line.chars().take(MAX_LINE_LENGTH).collect()
        } else {
            line
        };
        if app
            .emit(
                "project-output",
                OutputPayload {
                    id: id.clone(),
                    line,
                },
            )
            .is_err()
        {
            break;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{validate_command, validate_folder};

    #[test]
    fn a_project_folder_must_be_absolute_and_exist() {
        assert!(validate_folder("relative/folder").is_err());
        assert!(validate_folder("").is_err());
        assert!(validate_folder(&std::env::temp_dir().display().to_string()).is_ok());
    }

    #[test]
    fn a_start_command_must_be_the_manifests_own_text() {
        assert!(validate_command("").is_err());
        assert!(validate_command("   ").is_err());
        assert!(validate_command("vite\0").is_err());
        assert_eq!(validate_command("  pnpm dev  ").unwrap(), "pnpm dev");
    }
}
