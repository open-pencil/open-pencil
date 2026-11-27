//! Host programs the app starts for the editor: ACP agents, an agent's login, package installs,
//! the MCP server, and the harness companion. The editor names one from a fixed table
//! (`program`), and talks to it through these commands; the app checks what passes between an
//! agent and the editor (`acp`, `harness`) and asks the person in a window of its own
//! (`permission`). Programs stop with the page that started them and with the app, except the
//! MCP server, which outlives a reload so its clients stay connected (`mcp`).

mod acp;
mod harness;
mod input;
mod jsonrpc;
mod lines;
mod mcp;
pub mod permission;
pub mod program;

use parking_lot::Mutex;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::Duration;

use serde::Serialize;
use serde_json::Value;
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

use crate::capabilities::DesktopCapabilities;
use acp::{AcpGate, FromAgent, FromEditor};
use input::Input;
use lines::Lines;
use permission::{Permissions, Question, Reply};
use program::{LaunchContext, ProgramRequest, Protocol};

/// The only window that starts programs.
const EDITOR_WINDOW: &str = "main";
/// How long an agent's question waits before it is refused; `ACP_PERMISSION_TIMEOUT_MS`.
const QUESTION_TIMEOUT: Duration = Duration::from_secs(60);
/// The answer that confirms a mode in the permission window.
const ALLOW_MODE: &str = "allow";

/// What a program sends the editor.
#[derive(Clone, Debug, Serialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum HostEvent {
    /// Output, with each line of a JSON-lines protocol whole and ending in `\n`.
    Stdout {
        data: String,
    },
    Stderr {
        data: String,
    },
    /// The program ended.
    Close {
        code: Option<i32>,
        signal: Option<i32>,
    },
    /// The agent waits on the person in the permission window, or no longer does; `id` tells
    /// one question from another with the same title.
    Permission {
        id: u64,
        title: String,
        waiting: bool,
    },
}

enum Gate {
    Acp(Box<AcpGate>),
    Harness,
    /// The MCP server: its questions about files go to the permission window.
    Mcp,
    Plain,
}

struct Running {
    child: Input,
    pid: u32,
    gate: Gate,
    /// The agent's name, which the permission window shows.
    agent: &'static str,
    events: Channel<HostEvent>,
    /// What the program wrote, and the editor, cut into lines for the gates.
    from_program: Lines,
    from_editor: Lines,
}

#[derive(Default)]
pub struct HostProcesses {
    next: AtomicU32,
    running: Mutex<HashMap<u32, Running>>,
    /// The MCP server the app runs: its handle, what it was started with, and its tokens.
    mcp: Mutex<Option<McpRun>>,
    /// Held across a start of the MCP server, so two starts never run two servers.
    mcp_start: tokio::sync::Mutex<()>,
}

struct McpRun {
    id: u32,
    request: ProgramRequest,
    tokens: mcp::McpTokens,
}

impl HostProcesses {
    fn lock(&self) -> parking_lot::MutexGuard<'_, HashMap<u32, Running>> {
        self.running.lock()
    }

    /// Stops every program, as when the app quits; a reload keeps the MCP server, which the
    /// next page takes over.
    pub fn stop_all<R: Runtime>(&self, app: &AppHandle<R>, keep_mcp: bool) {
        let kept = if keep_mcp { self.mcp_id() } else { None };
        let stopped: Vec<(u32, Running)> = {
            let mut running = self.lock();
            let ids: Vec<u32> = running
                .keys()
                .copied()
                .filter(|id| Some(*id) != kept)
                .collect();
            ids.into_iter()
                .filter_map(|id| running.remove(&id).map(|process| (id, process)))
                .collect()
        };
        for (id, running) in stopped {
            app.state::<Permissions>().cancel(app, id, None);
            stop(&running);
        }
    }
}

/// Ends a program. One blocked on a write cannot give up its handle, so it ends by its pid.
fn stop(running: &Running) {
    match running.child.take() {
        Some(child) => {
            let _ = child.kill();
        }
        None => kill_pid(running.pid),
    }
}

fn kill_pid(pid: u32) {
    #[cfg(unix)]
    let _ = std::process::Command::new("kill")
        .args(["-9", &pid.to_string()])
        .status();
    #[cfg(windows)]
    let _ = std::process::Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .status();
}

/// The editor's origin, which the MCP server lets call it. A `tauri://localhost` page has an
/// opaque origin by the URL standard, which serializes as `null`, so it is spelled out.
fn editor_origin(url: &url::Url) -> String {
    match url.scheme() {
        "http" | "https" => url.origin().ascii_serialization(),
        scheme => match (url.host_str(), url.port()) {
            (Some(host), Some(port)) => format!("{scheme}://{host}:{port}"),
            (Some(host), None) => format!("{scheme}://{host}"),
            (None, _) => format!("{scheme}://"),
        },
    }
}

/// The folder agents run in, which the app creates in its data folder. Starting them in the home
/// folder would let them read its project settings and, sandboxed, write anywhere in it.
pub fn agent_workspace_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not find the app data folder: {e}"))?
        .join("agent-workspace");
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Could not create the agent workspace: {e}"))?;
    Ok(dir)
}

impl HostProcesses {
    fn mcp_lock(&self) -> parking_lot::MutexGuard<'_, Option<McpRun>> {
        self.mcp.lock()
    }

    fn mcp_id(&self) -> Option<u32> {
        self.mcp_lock().as_ref().map(|run| run.id)
    }
}

fn from_editor<R: Runtime>(
    webview: &tauri::Webview<R>,
    capabilities: &DesktopCapabilities,
) -> Result<(), String> {
    if !capabilities.host_processes {
        return Err("This package of OpenPencil does not start other programs.".to_owned());
    }
    if webview.label() != EDITOR_WINDOW {
        return Err("Only the editor starts programs.".to_owned());
    }
    Ok(())
}

/// Starts a program from the table and returns its handle; what it sends arrives on `events`.
#[tauri::command]
pub async fn host_start<R: Runtime>(
    app: AppHandle<R>,
    webview: tauri::Webview<R>,
    capabilities: tauri::State<'_, DesktopCapabilities>,
    program: ProgramRequest,
    events: Channel<HostEvent>,
) -> Result<u32, String> {
    from_editor(&webview, &capabilities)?;
    let processes = app.state::<HostProcesses>();
    let is_mcp = matches!(program, ProgramRequest::McpServer { .. });
    // Held until the server is recorded, so a second start reuses it or waits for it.
    let _starting = if is_mcp {
        Some(processes.mcp_start.lock().await)
    } else {
        None
    };
    if is_mcp {
        // A reloaded page takes over the server it left running, when nothing about it changed.
        let mcp = processes.mcp_lock();
        if let Some(run) = mcp.as_ref().filter(|run| run.request == program) {
            if let Some(process) = processes.lock().get_mut(&run.id) {
                process.events = events;
                return Ok(run.id);
            }
        }
    }
    let workspace = agent_workspace_dir(&app)?;
    let origin = editor_origin(&webview.url().map_err(|e| e.to_string())?);
    let launch = program.launch(&LaunchContext {
        workspace: &workspace,
        origin: &origin,
    })?;

    let search_path = crate::agents::path::augment_path(
        &std::env::var("PATH").unwrap_or_default(),
        &crate::agents::path::candidate_dirs(),
    );
    let cwd = launch.cwd.clone().unwrap_or_else(|| workspace.clone());
    // Found here, by its full path, so a program left in the working folder never runs in its
    // place, as `cmd` would find one there first on Windows.
    let executable = which::which_in(launch.program, Some(&search_path), &cwd)
        .map_err(|_| format!("{} is not installed.", launch.program))?;
    let tokens = if is_mcp {
        Some(mcp::McpTokens::generate()?)
    } else {
        None
    };
    // Only a request that can start replaces the server running now, which its clients use.
    if is_mcp {
        let previous = processes.mcp_lock().take();
        if let Some(run) = previous {
            if let Some(process) = processes.lock().remove(&run.id) {
                app.state::<Permissions>().cancel(&app, run.id, None);
                stop(&process);
            }
        }
    }
    let mut command = app.shell().command(executable);
    if is_mcp {
        // The server reads its settings from the environment: only the app's may reach it.
        command = command
            .env_clear()
            .envs(std::env::vars().filter(|(key, _)| !key.starts_with("OPENPENCIL_MCP_")));
    }
    let mut command = command
        .args(&launch.args)
        .env("PATH", &search_path)
        .envs(launch.env.iter().map(|(key, value)| (*key, value.as_str())))
        .set_raw_out(true);
    if let Some(tokens) = &tokens {
        command = command
            .env("OPENPENCIL_MCP_AUTH_TOKEN", &tokens.server)
            .env("OPENPENCIL_MCP_APP_TOKEN", &tokens.app);
    }
    if let Some(dir) = &launch.cwd {
        command = command.current_dir(dir);
    }
    #[cfg(windows)]
    {
        command = command.env("NoDefaultCurrentDirectoryInExePath", "1");
    }
    let (mut output, child) = command.spawn().map_err(|e| e.to_string())?;

    let (gate, agent) = match launch.protocol {
        Protocol::Acp(agent, refuses_tools) => (
            Gate::Acp(Box::new(AcpGate::new(
                agent,
                workspace.to_string_lossy().into_owned(),
                refuses_tools,
            ))),
            agent.name(),
        ),
        Protocol::Harness => (Gate::Harness, "Pi"),
        Protocol::Mcp => (Gate::Mcp, ""),
        Protocol::Plain => (Gate::Plain, ""),
    };
    let id = processes.next.fetch_add(1, Ordering::Relaxed);
    let pid = child.pid();
    processes.lock().insert(
        id,
        Running {
            child: Input::new(child),
            pid,
            gate,
            agent,
            events,
            from_program: Lines::default(),
            from_editor: Lines::default(),
        },
    );
    if let Some(tokens) = tokens {
        *processes.mcp_lock() = Some(McpRun {
            id,
            request: program,
            tokens,
        });
    }

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = output.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => from_program(&app, id, &bytes),
                CommandEvent::Stderr(bytes) => send(
                    &app,
                    id,
                    HostEvent::Stderr {
                        data: String::from_utf8_lossy(&bytes).into_owned(),
                    },
                ),
                CommandEvent::Terminated(payload) => {
                    app.state::<Permissions>().cancel(&app, id, None);
                    let processes = app.state::<HostProcesses>();
                    let mut mcp = processes.mcp_lock();
                    if mcp.as_ref().is_some_and(|run| run.id == id) {
                        *mcp = None;
                    }
                    drop(mcp);
                    if let Some(running) = app.state::<HostProcesses>().lock().remove(&id) {
                        let _ = running.events.send(HostEvent::Close {
                            code: payload.code,
                            signal: payload.signal,
                        });
                    }
                }
                CommandEvent::Error(message) => send(&app, id, HostEvent::Stderr { data: message }),
                _ => {}
            }
        }
    });
    Ok(id)
}

/// Sends a program what the editor wrote. A JSON-lines program gets whole lines once checked.
#[tauri::command]
pub async fn host_write<R: Runtime>(
    app: AppHandle<R>,
    webview: tauri::Webview<R>,
    capabilities: tauri::State<'_, DesktopCapabilities>,
    id: u32,
    data: String,
) -> Result<(), String> {
    from_editor(&webview, &capabilities)?;
    let (written, later, agent) = check_editor_input(&app, id, &data)?;
    for step in later {
        match step {
            Later::Cancel(session) => app.state::<Permissions>().cancel(&app, id, Some(&session)),
            Later::Confirm(change) => confirm_mode(&app, id, agent, change),
        }
    }
    input::written(written).await
}

/// Cuts the editor's input into lines, checks each one, and queues what passes, under the process
/// table's lock so two writes reach the program in the order the editor made them; nothing here
/// waits on the program. A login reads what the person pasted as it is.
fn check_editor_input<R: Runtime>(
    app: &AppHandle<R>,
    id: u32,
    data: &str,
) -> Result<(input::Written, Vec<Later>, &'static str), String> {
    let processes = app.state::<HostProcesses>();
    let mut running = processes.lock();
    let process = running.get_mut(&id).ok_or("The program has stopped.")?;
    let mut out = Vec::new();
    let mut later = Vec::new();
    match &mut process.gate {
        Gate::Plain => {
            let written = process.child.bytes(data.as_bytes().to_vec());
            return Ok((written, later, process.agent));
        }
        // Only the app answers the server's questions on its standard input.
        Gate::Mcp => return Err("The MCP server takes no input from the editor.".to_owned()),
        Gate::Acp(gate) => {
            for line in process.from_editor.push(data.as_bytes()).lines {
                match gate.editor_wrote(line) {
                    FromEditor::Forward(line) => out.push(line),
                    FromEditor::Refuse(answer) => {
                        if let Some(answer) = answer {
                            let _ = process.events.send(HostEvent::Stdout {
                                data: answer + "\n",
                            });
                        }
                    }
                    FromEditor::Cancel { session_id, line } => {
                        out.push(line);
                        later.push(Later::Cancel(session_id));
                    }
                    FromEditor::Confirm(change) => later.push(Later::Confirm(change)),
                }
            }
        }
        Gate::Harness => {
            for line in process.from_editor.push(data.as_bytes()).lines {
                match harness::from_editor(line) {
                    Ok(line) => out.push(line),
                    Err(Some(answer)) => {
                        let _ = process.events.send(HostEvent::Stdout {
                            data: answer + "\n",
                        });
                    }
                    Err(None) => {}
                }
            }
        }
    }
    Ok((process.child.lines(out), later, process.agent))
}

enum Later {
    Cancel(String),
    Confirm(acp::ModeChange),
}

/// Stops a program.
#[tauri::command]
pub fn host_kill<R: Runtime>(
    app: AppHandle<R>,
    webview: tauri::Webview<R>,
    capabilities: tauri::State<'_, DesktopCapabilities>,
    id: u32,
) -> Result<(), String> {
    from_editor(&webview, &capabilities)?;
    app.state::<Permissions>().cancel(&app, id, None);
    let processes = app.state::<HostProcesses>();
    let mut mcp = processes.mcp_lock();
    if mcp.as_ref().is_some_and(|run| run.id == id) {
        *mcp = None;
    }
    drop(mcp);
    let running = processes.lock().remove(&id);
    if let Some(running) = running {
        stop(&running);
        let _ = running.events.send(HostEvent::Close {
            code: None,
            signal: None,
        });
    }
    Ok(())
}

fn send<R: Runtime>(app: &AppHandle<R>, id: u32, event: HostEvent) {
    if let Some(running) = app.state::<HostProcesses>().lock().get(&id) {
        let _ = running.events.send(event);
    }
}

fn from_program<R: Runtime>(app: &AppHandle<R>, id: u32, bytes: &[u8]) {
    let processes = app.state::<HostProcesses>();
    let mut running = processes.lock();
    let Some(process) = running.get_mut(&id) else {
        return;
    };
    if matches!(process.gate, Gate::Plain) {
        let data = String::from_utf8_lossy(bytes).into_owned();
        let _ = process.events.send(HostEvent::Stdout { data });
        return;
    }
    let read = process.from_program.push(bytes);
    if read.dropped {
        let _ = process.events.send(HostEvent::Stderr {
            data: format!(
                "Dropped a message longer than {} bytes.",
                lines::MAX_LINE_BYTES
            ),
        });
    }
    let mut to_program = Vec::new();
    let mut tools = Vec::new();
    let mut files = Vec::new();
    let mut shown = String::new();
    match &mut process.gate {
        Gate::Mcp => {
            for line in read.lines {
                match mcp::consent_request(&line) {
                    Some(request) => files.push(request),
                    None => shown.push_str(&(line + "\n")),
                }
            }
        }
        // Harness lines pass whole, so the editor reads one message at a time.
        Gate::Harness => {
            for line in read.lines {
                shown.push_str(&(line + "\n"));
            }
        }
        Gate::Acp(gate) => {
            for line in read.lines {
                match gate.agent_wrote(line) {
                    FromAgent::Forward(line) => shown.push_str(&(line + "\n")),
                    FromAgent::Answer(answer) | FromAgent::Send(answer) => to_program.push(answer),
                    FromAgent::Ask(ask) => tools.push(ask),
                    FromAgent::Drop => {}
                }
            }
        }
        Gate::Plain => unreachable!("passed on above"),
    }
    if !shown.is_empty() {
        let _ = process.events.send(HostEvent::Stdout { data: shown });
    }
    process.child.send(to_program);
    let agent = process.agent;
    drop(running);
    for ask in tools {
        ask_about_tool(app, id, agent, ask);
    }
    for request in files {
        ask_about_file(app, id, request);
    }
}

/// Puts a tool request to the person, and writes their answer to the agent.
fn ask_about_tool<R: Runtime>(
    app: &AppHandle<R>,
    id: u32,
    agent: &'static str,
    ask: acp::PermissionAsk,
) {
    let title = ask
        .params
        .get("toolCall")
        .and_then(|call| call.get("title"))
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_owned();
    let reject = acp::reject_option(&ask.params);
    let question = Question::Tool {
        agent: agent.to_owned(),
        params: ask.params.clone(),
    };
    let (question_id, reply) =
        app.state::<Permissions>()
            .ask(app, question, id, ask.session_id.clone());
    // A Stop that came between the agent's request and this question already cancelled the
    // questions it found, so this one is cancelled too.
    if !asked_this_turn(app, id, &ask.session_id, ask.turn) {
        app.state::<Permissions>()
            .settle(app, question_id, Reply::Cancelled);
    }
    // Kept apart from the process, so the editor hears the question ended even when the agent
    // was stopped while it waited.
    let Some(events) = app
        .state::<HostProcesses>()
        .lock()
        .get(&id)
        .map(|process| process.events.clone())
    else {
        return;
    };
    let _ = events.send(HostEvent::Permission {
        id: question_id,
        title: title.clone(),
        waiting: true,
    });
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let reply = wait(&app, question_id, reply).await;
        let _ = events.send(HostEvent::Permission {
            id: question_id,
            title,
            waiting: false,
        });
        let processes = app.state::<HostProcesses>();
        let mut running = processes.lock();
        let Some(process) = running.get_mut(&id) else {
            return;
        };
        let Gate::Acp(gate) = &mut process.gate else {
            return;
        };
        // A Stop while the person answered ends the question: the agent hears it cancelled.
        let option = match &reply {
            _ if gate.turn(&ask.session_id) != ask.turn => None,
            Reply::Chose(option) => Some(option.as_str()),
            Reply::Refused => reject.as_deref(),
            Reply::Cancelled => None,
        };
        let answer = gate.answer(&ask.id, option);
        process.child.send(vec![answer]);
    });
}

/// Puts the MCP server's question about a file to the person. Allowing a document tool lets the
/// editor open and save that file; the server reads and writes other tools' files itself.
fn ask_about_file<R: Runtime>(app: &AppHandle<R>, id: u32, request: mcp::ConsentRequest) {
    let question = Question::File {
        client: request.client.clone().unwrap_or_default(),
        tool: request.tool.clone(),
        write: request.access == mcp::Access::Write,
        path: request.path.clone(),
    };
    let (question_id, reply) = app
        .state::<Permissions>()
        .ask(app, question, id, String::new());
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut allowed = matches!(wait(&app, question_id, reply).await, Reply::Chose(_));
        if allowed && mcp::editor_opens(&request.tool) {
            // The editor opens or saves the file itself, so the answer is yes only once it can.
            if let Err(error) = give_editor(&app, &request) {
                eprintln!("[mcp] could not give the editor {}: {error}", request.path);
                allowed = false;
            }
        }
        if let Some(process) = app.state::<HostProcesses>().lock().get(&id) {
            process
                .child
                .send(vec![mcp::consent_answer(request.id, allowed)]);
        }
    });
}

/// Gives the editor a file a document tool was allowed, with the folder a save into a new one
/// needs, which the editor, given the file alone, cannot make.
fn give_editor<R: Runtime>(
    app: &AppHandle<R>,
    request: &mcp::ConsentRequest,
) -> Result<(), String> {
    use tauri_plugin_fs::FsExt;
    if request.access == mcp::Access::Write {
        if let Some(parent) = std::path::Path::new(&request.path).parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    app.fs_scope()
        .allow_file(&request.path)
        .map_err(|e| e.to_string())
}

/// The tokens the editor connects to the app's MCP server with, while it runs.
#[tauri::command]
pub fn mcp_tokens<R: Runtime>(
    app: AppHandle<R>,
    webview: tauri::Webview<R>,
    capabilities: tauri::State<'_, DesktopCapabilities>,
) -> Result<Option<mcp::EditorTokens>, String> {
    from_editor(&webview, &capabilities)?;
    Ok(app
        .state::<HostProcesses>()
        .mcp_lock()
        .as_ref()
        .map(|run| run.tokens.for_editor()))
}

/// Puts a mode that never asks to the person; the editor's request goes on only if they allow it,
/// and only while the turn it was made in still runs.
fn confirm_mode<R: Runtime>(
    app: &AppHandle<R>,
    id: u32,
    agent: &'static str,
    change: acp::ModeChange,
) {
    let question = Question::Mode {
        agent: agent.to_owned(),
        mode: change.mode.clone(),
    };
    let (question_id, reply) =
        app.state::<Permissions>()
            .ask(app, question, id, change.session_id.clone());
    if !asked_this_turn(app, id, &change.session_id, change.turn) {
        app.state::<Permissions>()
            .settle(app, question_id, Reply::Cancelled);
    }
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let reply = wait(&app, question_id, reply).await;
        let processes = app.state::<HostProcesses>();
        let running = processes.lock();
        let Some(process) = running.get(&id) else {
            return;
        };
        let current = match &process.gate {
            Gate::Acp(gate) => gate.turn(&change.session_id) == change.turn,
            _ => false,
        };
        if current && reply == Reply::Chose(ALLOW_MODE.to_owned()) {
            process.child.send(vec![change.line]);
        } else if let Some(request) = &change.id {
            let answer = acp::mode_refused(request);
            let _ = process.events.send(HostEvent::Stdout {
                data: answer + "\n",
            });
        }
    });
}

/// Whether the editor has not stopped `session` since a question of `turn` was put.
fn asked_this_turn<R: Runtime>(app: &AppHandle<R>, id: u32, session: &str, turn: u64) -> bool {
    let processes = app.state::<HostProcesses>();
    let running = processes.lock();
    match running.get(&id).map(|process| &process.gate) {
        Some(Gate::Acp(gate)) => gate.turn(session) == turn,
        _ => false,
    }
}

/// The person's reply, or a refusal once the question has waited too long.
async fn wait<R: Runtime>(
    app: &AppHandle<R>,
    question: u64,
    reply: tokio::sync::oneshot::Receiver<Reply>,
) -> Reply {
    match tokio::time::timeout(QUESTION_TIMEOUT, reply).await {
        Ok(Ok(reply)) => reply,
        Ok(Err(_)) => Reply::Cancelled,
        Err(_) => {
            app.state::<Permissions>()
                .settle(app, question, Reply::Refused);
            Reply::Refused
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spells_out_the_origin_of_an_app_page() {
        let origin = |url: &str| editor_origin(&url::Url::parse(url).unwrap());
        assert_eq!(origin("tauri://localhost/index.html"), "tauri://localhost");
        assert_eq!(origin("http://tauri.localhost/"), "http://tauri.localhost");
        assert_eq!(
            origin("http://localhost:1421/editor"),
            "http://localhost:1421"
        );
    }
}
