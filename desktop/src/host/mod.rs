//! Host programs the app starts for the editor: ACP agents, an agent's login, package installs,
//! the MCP server, and the harness companion. The editor names one from a fixed table
//! (`program`), and talks to it through these commands; the app checks what passes between an
//! agent and the editor (`acp`, `harness`) and asks the person in a window of its own
//! (`permission`). Programs stop with the page that started them and with the app, except the
//! MCP server, which outlives a reload so its clients stay connected (`mcp`).

mod acp;
mod harness;
mod lines;
mod mcp;
pub mod permission;
pub mod program;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use serde::Serialize;
use serde_json::Value;
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

use crate::capabilities::DesktopCapabilities;
use acp::{AcpGate, FromAgent, FromEditor};
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
    Stdout { data: String },
    Stderr { data: String },
    /// The program ended.
    Close {
        code: Option<i32>,
        signal: Option<i32>,
    },
    /// The agent waits on the person in the permission window, or no longer does.
    Permission { title: String, waiting: bool },
}

enum Gate {
    Acp(AcpGate),
    Harness,
    /// The MCP server: its questions about files go to the permission window.
    Mcp,
    Plain,
}

struct Running {
    child: CommandChild,
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
}

struct McpRun {
    id: u32,
    request: ProgramRequest,
    tokens: mcp::McpTokens,
}

impl HostProcesses {
    fn lock(&self) -> std::sync::MutexGuard<'_, HashMap<u32, Running>> {
        self.running.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    /// Stops every program, as when the app quits; a reload keeps the MCP server, which the
    /// next page takes over.
    pub fn stop_all<R: Runtime>(&self, app: &AppHandle<R>, keep_mcp: bool) {
        let kept = if keep_mcp { self.mcp_id() } else { None };
        let stopped: Vec<(u32, Running)> = {
            let mut running = self.lock();
            let ids: Vec<u32> = running.keys().copied().filter(|id| Some(*id) != kept).collect();
            ids.into_iter()
                .filter_map(|id| running.remove(&id).map(|process| (id, process)))
                .collect()
        };
        for (id, running) in stopped {
            app.state::<Permissions>().cancel(app, id, None);
            let _ = running.child.kill();
        }
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
    std::fs::create_dir_all(&dir).map_err(|e| format!("Could not create the agent workspace: {e}"))?;
    Ok(dir)
}

impl HostProcesses {
    fn mcp_lock(&self) -> std::sync::MutexGuard<'_, Option<McpRun>> {
        self.mcp.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
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
    let mut tokens = None;
    if matches!(program, ProgramRequest::McpServer { .. }) {
        // A reloaded page takes over the server it left running, when nothing about it changed.
        let previous = processes.mcp_lock().take();
        if let Some(run) = previous {
            let mut running = processes.lock();
            if run.request == program {
                if let Some(process) = running.get_mut(&run.id) {
                    process.events = events;
                    let id = run.id;
                    drop(running);
                    *processes.mcp_lock() = Some(run);
                    return Ok(id);
                }
            } else if let Some(process) = running.remove(&run.id) {
                let _ = process.child.kill();
            }
        }
        tokens = Some(mcp::McpTokens::generate()?);
    }
    let workspace = agent_workspace_dir(&app)?;
    let origin = webview
        .url()
        .map_err(|e| e.to_string())?
        .origin()
        .ascii_serialization();
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
    let mut command = app
        .shell()
        .command(executable)
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
            Gate::Acp(AcpGate::new(
                agent,
                workspace.to_string_lossy().into_owned(),
                refuses_tools,
            )),
            agent.name(),
        ),
        Protocol::Harness => (Gate::Harness, "Pi"),
        Protocol::Mcp => (Gate::Mcp, ""),
        Protocol::Plain => (Gate::Plain, ""),
    };
    let id = processes.next.fetch_add(1, Ordering::Relaxed);
    processes.lock().insert(
        id,
        Running {
            child,
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

    tauri::async_runtime::spawn(async move {
        while let Some(event) = output.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => from_program(&app, id, &bytes),
                CommandEvent::Stderr(bytes) => send(&app, id, HostEvent::Stderr {
                    data: String::from_utf8_lossy(&bytes).into_owned(),
                }),
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
pub fn host_write<R: Runtime>(
    app: AppHandle<R>,
    webview: tauri::Webview<R>,
    capabilities: tauri::State<'_, DesktopCapabilities>,
    id: u32,
    data: String,
) -> Result<(), String> {
    from_editor(&webview, &capabilities)?;
    let processes = app.state::<HostProcesses>();
    let mut running = processes.lock();
    let process = running.get_mut(&id).ok_or("The program has stopped.")?;
    match process.gate {
        Gate::Plain => return process.child.write(data.as_bytes()).map_err(|e| e.to_string()),
        // Only the app answers the server's questions on its standard input.
        Gate::Mcp => return Err("The MCP server takes no input from the editor.".to_owned()),
        _ => {}
    }
    let lines = process.from_editor.push(data.as_bytes());
    let mut later = Vec::new();
    for line in lines {
        match &mut process.gate {
            Gate::Acp(gate) => match gate.from_editor(line) {
                FromEditor::Forward(line) => write_line(&mut process.child, &line)?,
                FromEditor::Refuse(answer) => {
                    if let Some(answer) = answer {
                        let _ = process.events.send(HostEvent::Stdout { data: answer + "\n" });
                    }
                }
                FromEditor::Cancel { session_id, line } => {
                    write_line(&mut process.child, &line)?;
                    later.push(Later::Cancel(session_id));
                }
                FromEditor::Confirm(change) => later.push(Later::Confirm(change)),
            },
            Gate::Harness => match harness::from_editor(line) {
                Ok(line) => write_line(&mut process.child, &line)?,
                Err(Some(answer)) => {
                    let _ = process.events.send(HostEvent::Stdout { data: answer + "\n" });
                }
                Err(None) => {}
            },
            Gate::Plain | Gate::Mcp => unreachable!("answered above"),
        }
    }
    let agent = process.agent;
    drop(running);
    for step in later {
        match step {
            Later::Cancel(session) => app.state::<Permissions>().cancel(&app, id, Some(&session)),
            Later::Confirm(change) => confirm_mode(&app, id, agent, change),
        }
    }
    Ok(())
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
        running.child.kill().map_err(|e| e.to_string())?;
        let _ = running.events.send(HostEvent::Close {
            code: None,
            signal: None,
        });
    }
    Ok(())
}

fn write_line(child: &mut CommandChild, line: &str) -> Result<(), String> {
    let mut bytes = Vec::with_capacity(line.len() + 1);
    bytes.extend_from_slice(line.as_bytes());
    bytes.push(b'\n');
    child.write(&bytes).map_err(|e| e.to_string())
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
    if matches!(process.gate, Gate::Mcp) {
        let mut asks = Vec::new();
        let mut shown = String::new();
        for line in process.from_program.push(bytes) {
            match mcp::consent_request(&line) {
                Some(request) => asks.push(request),
                None => shown.push_str(&(line + "\n")),
            }
        }
        if !shown.is_empty() {
            let _ = process.events.send(HostEvent::Stdout { data: shown });
        }
        drop(running);
        for request in asks {
            ask_about_file(app, id, request);
        }
        return;
    }
    let Gate::Acp(gate) = &mut process.gate else {
        let data = match process.gate {
            // Harness lines pass whole, so the editor reads one message at a time.
            Gate::Harness => process
                .from_program
                .push(bytes)
                .into_iter()
                .map(|line| line + "\n")
                .collect(),
            _ => String::from_utf8_lossy(bytes).into_owned(),
        };
        if !data.is_empty() {
            let _ = process.events.send(HostEvent::Stdout { data });
        }
        return;
    };
    let mut asks = Vec::new();
    for line in process.from_program.push(bytes) {
        match gate.from_agent(line) {
            FromAgent::Forward(line) => {
                let _ = process.events.send(HostEvent::Stdout { data: line + "\n" });
            }
            FromAgent::Answer(answer) => {
                let _ = write_line(&mut process.child, &answer);
            }
            FromAgent::Ask(ask) => asks.push(ask),
        }
    }
    let agent = process.agent;
    drop(running);
    for ask in asks {
        ask_about_tool(app, id, agent, ask);
    }
}

/// Puts a tool request to the person, and writes their answer to the agent.
fn ask_about_tool<R: Runtime>(app: &AppHandle<R>, id: u32, agent: &'static str, ask: acp::PermissionAsk) {
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
    let (question_id, reply) = app
        .state::<Permissions>()
        .ask(app, question, id, ask.session_id.clone());
    send(app, id, HostEvent::Permission {
        title: title.clone(),
        waiting: true,
    });
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let reply = wait(&app, question_id, reply).await;
        let processes = app.state::<HostProcesses>();
        let mut running = processes.lock();
        let Some(process) = running.get_mut(&id) else {
            return;
        };
        let Gate::Acp(gate) = &mut process.gate else {
            return;
        };
        let option = match &reply {
            Reply::Chose(option) => Some(option.as_str()),
            Reply::Refused => reject.as_deref(),
            Reply::Cancelled => None,
        };
        let answer = gate.answer(&ask.id, option);
        let _ = write_line(&mut process.child, &answer);
        let _ = process.events.send(HostEvent::Permission {
            title,
            waiting: false,
        });
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
        let allowed = matches!(wait(&app, question_id, reply).await, Reply::Chose(_));
        if allowed && mcp::editor_opens(&request.tool) {
            use tauri_plugin_fs::FsExt;
            // A save to a new folder inside the MCP root needs the folder, which the editor,
            // given the file alone, cannot make.
            if request.access == mcp::Access::Write {
                if let Some(parent) = std::path::Path::new(&request.path).parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
            }
            if let Err(error) = app.fs_scope().allow_file(&request.path) {
                eprintln!("[mcp] could not allow {}: {error}", request.path);
            }
        }
        let processes = app.state::<HostProcesses>();
        let mut running = processes.lock();
        if let Some(process) = running.get_mut(&id) {
            let _ = write_line(&mut process.child, &mcp::consent_answer(request.id, allowed));
        }
    });
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

/// Puts a mode that never asks to the person; the editor's request goes on only if they allow it.
fn confirm_mode<R: Runtime>(app: &AppHandle<R>, id: u32, agent: &'static str, change: acp::ModeChange) {
    let session = serde_json::from_str::<Value>(&change.line)
        .ok()
        .and_then(|message| {
            message
                .get("params")
                .and_then(|params| params.get("sessionId"))
                .and_then(Value::as_str)
                .map(str::to_owned)
        })
        .unwrap_or_default();
    let question = Question::Mode {
        agent: agent.to_owned(),
        mode: change.mode.clone(),
    };
    let (question_id, reply) = app.state::<Permissions>().ask(app, question, id, session);
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let reply = wait(&app, question_id, reply).await;
        let processes = app.state::<HostProcesses>();
        let mut running = processes.lock();
        let Some(process) = running.get_mut(&id) else {
            return;
        };
        if reply == Reply::Chose(ALLOW_MODE.to_owned()) {
            let _ = write_line(&mut process.child, &change.line);
        } else if let Some(request) = &change.id {
            let answer = acp::error_response(request, "The mode was not allowed.");
            let _ = process.events.send(HostEvent::Stdout { data: answer + "\n" });
        }
    });
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
            app.state::<Permissions>().settle(app, question, Reply::Refused);
            Reply::Refused
        }
    }
}
