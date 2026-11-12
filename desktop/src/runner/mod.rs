//! Starting the application a project holds.
//!
//! A project's start command comes from its manifest, so it cannot be pinned in
//! `shell:allow-spawn` (`desktop/AGENTS.md`): this command runs it in the folder the application
//! lives in, with that folder's own `node_modules/.bin` ahead of the path the way a package script
//! sees it, and forwards what it prints to the window that started it.

use std::collections::HashMap;
use std::io::{BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

/// A line longer than this is cut, so a runaway program cannot fill the window's memory.
const MAX_LINE_LENGTH: usize = 2000;
/// The most bytes one line may hold before the rest of it is dropped. A character takes at most
/// four bytes, so this bounds what a line costs while it is being read as well as when it is shown.
const MAX_LINE_BYTES: usize = MAX_LINE_LENGTH * 4;
/// The longest start command a project may hold: a package script, not a program of its own.
const MAX_COMMAND_LENGTH: usize = 2000;

/// The window the editor runs in, which is the only one that may run a project's application.
const EDITOR_WINDOW: &str = "main";

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
    window: tauri::WebviewWindow<R>,
    capabilities: tauri::State<'_, crate::capabilities::DesktopCapabilities>,
    state: tauri::State<'_, RunnerState>,
    id: String,
    directory: String,
    command: String,
) -> Result<u32, String> {
    // A shell command runs only when the editor asks and the build allows host programs: the
    // updater's window and any other webview have no business starting one.
    require_editor_window(&window)?;
    capabilities.require_host_processes()?;
    let folder = validate_folder(&directory)?;
    let command = validate_command(&command)?;
    let processes = Arc::clone(&state.0);

    // One run per project: a second start replaces the first rather than stacking servers.
    stop(&processes, &id);

    let mut child = spawn(&folder, &command)?;
    let pid = child.id();
    // The entry goes in before the thread that waits for the exit starts: a program that exits at
    // once then finds its own entry and removes it, rather than leaving a dead id that a later
    // read reports as running and a later stop signals.
    if let Ok(mut running) = processes.lock() {
        running.insert(id.clone(), pid);
    }
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
        // A replaced or stopped run leaves the screen showing whatever holds the project now, so
        // its exit is not news the screen is waiting for; only a run that still owns the entry
        // reports one.
        if !forget_own(&processes, &project, pid) {
            return;
        }
        let _ = window.emit("project-exit", ExitPayload { id: project, code });
    });

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

/// Forget the project's run when the entry is this run's own, answering whether it was. A project
/// started again holds the newer process id, and a run stopped on purpose has no entry at all: the
/// id may already belong to somebody else, so only an entry that is still ours goes.
fn forget_own(processes: &Arc<Mutex<HashMap<String, u32>>>, id: &str, pid: u32) -> bool {
    let Ok(mut running) = processes.lock() else {
        return false;
    };
    if running.get(id) != Some(&pid) {
        return false;
    }
    running.remove(id);
    true
}

/// Whether the command came from the editor window, which is the only one that runs an application.
fn require_editor_window<R: tauri::Runtime>(
    window: &tauri::WebviewWindow<R>,
) -> Result<(), String> {
    if window.label() == EDITOR_WINDOW {
        return Ok(());
    }
    Err("only the editor window runs an application".to_owned())
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
        crate::process::hide_console_window(&mut process);
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
        let mut command = Command::new("taskkill");
        command
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        crate::process::hide_console_window(&mut command);
        let _ = command.status();
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
    forward_lines(stream, |line| {
        app.emit(
            "project-output",
            OutputPayload {
                id: id.clone(),
                line,
            },
        )
        .is_ok()
    })
}

/// Pass each line of `stream` to `emit`, which answers false when the window is gone.
///
/// The stream is read as bytes and decoded lossily: a command run through `cmd` on Windows prints
/// in the OEM code page, where a byte that is not UTF-8 is ordinary — reading `lines()` would end
/// the whole stream there and the program would meet a broken pipe on its next write. A line is
/// cut after [`MAX_LINE_BYTES`] bytes rather than read whole, so a program that prints one endless
/// line costs a fixed amount of memory and the lines after it still arrive.
fn forward_lines(stream: impl Read, mut emit: impl FnMut(String) -> bool) {
    let mut reader = BufReader::new(stream);
    let mut chunk = [0u8; 8192];
    let mut line: Vec<u8> = Vec::new();
    let mut cut = false;
    loop {
        let filled = match reader.read(&mut chunk) {
            Ok(0) => break,
            Ok(filled) => filled,
            Err(_) => break,
        };
        for &byte in &chunk[..filled] {
            if byte == b'\n' {
                // The `\r` of a Windows line ending belongs to the ending, not to the line.
                if line.last() == Some(&b'\r') {
                    line.pop();
                }
                if !emit(as_line(&line)) {
                    return;
                }
                line.clear();
                cut = false;
                continue;
            }
            if cut {
                continue;
            }
            if line.len() >= MAX_LINE_BYTES {
                cut = true;
                continue;
            }
            line.push(byte);
        }
    }
    // A last line without its newline is still a line, as it is in a terminal.
    if !line.is_empty() || cut {
        if line.last() == Some(&b'\r') {
            line.pop();
        }
        emit(as_line(&line));
    }
}

/// The bytes of one line as the window shows it: decoded even when they are not UTF-8, and no
/// longer than [`MAX_LINE_LENGTH`] characters.
fn as_line(bytes: &[u8]) -> String {
    let text = String::from_utf8_lossy(bytes);
    if text.chars().count() > MAX_LINE_LENGTH {
        text.chars().take(MAX_LINE_LENGTH).collect()
    } else {
        text.into_owned()
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;
    use std::sync::{Arc, Mutex};

    use super::{
        as_line, forget_own, forward_lines, validate_command, validate_folder, MAX_LINE_LENGTH,
    };

    fn processes(entries: &[(&str, u32)]) -> Arc<Mutex<HashMap<String, u32>>> {
        let map: HashMap<String, u32> = entries
            .iter()
            .map(|(id, pid)| ((*id).to_owned(), *pid))
            .collect();
        Arc::new(Mutex::new(map))
    }

    #[test]
    fn a_run_that_exits_forgets_its_own_entry() {
        let running = processes(&[("karbid", 7)]);

        assert!(forget_own(&running, "karbid", 7));
        assert!(running
            .lock()
            .expect("the lock is held by nobody")
            .is_empty());
    }

    #[test]
    fn a_replaced_run_leaves_the_entry_of_the_one_that_replaced_it() {
        let running = processes(&[("karbid", 2)]);

        // The first run woke after the second one was started and recorded.
        assert!(!forget_own(&running, "karbid", 1));
        assert_eq!(
            running
                .lock()
                .expect("the lock is held by nobody")
                .get("karbid"),
            Some(&2)
        );
    }

    #[test]
    fn a_run_that_was_stopped_reports_no_exit_of_its_own() {
        let running = processes(&[]);

        assert!(!forget_own(&running, "karbid", 7));
    }

    fn lines_of(output: &[u8]) -> Vec<String> {
        let mut lines = Vec::new();
        forward_lines(output, |line| {
            lines.push(line);
            true
        });
        lines
    }

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

    #[test]
    fn every_line_of_the_output_reaches_the_window() {
        assert_eq!(
            lines_of(b"VITE v8 ready\r\n  Local: http://localhost:5173/\n"),
            vec![
                "VITE v8 ready".to_owned(),
                "  Local: http://localhost:5173/".to_owned()
            ]
        );
    }

    #[test]
    fn a_last_line_without_its_newline_is_still_a_line() {
        assert_eq!(lines_of(b"done"), vec!["done".to_owned()]);
    }

    #[test]
    fn output_that_is_not_utf8_keeps_coming() {
        // `cmd` prints in the OEM code page: 0xE9 is not UTF-8, and the line after it matters more
        // than the byte.
        let lines = lines_of(b"caf\xe9 pr\xeat\nsecond line\n");
        assert_eq!(lines.len(), 2);
        assert!(lines[0].starts_with("caf"));
        assert_eq!(lines[1], "second line");
    }

    #[test]
    fn an_endless_line_is_cut_and_the_stream_continues() {
        let mut output = vec![b'x'; 50_000];
        output.extend_from_slice(b"\nafter\n");

        let lines = lines_of(&output);

        // The cut line arrives once, at the cap, and the line behind it is not lost with it.
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0].chars().count(), MAX_LINE_LENGTH);
        assert_eq!(lines[1], "after");
    }

    #[test]
    fn a_line_is_cut_to_the_length_the_window_shows() {
        assert_eq!(
            as_line(&vec![b'x'; MAX_LINE_LENGTH + 10]).chars().count(),
            MAX_LINE_LENGTH
        );
    }
}
