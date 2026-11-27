//! The questions agents ask the person, and the window that asks them. Only the app opens the
//! window, under a label no other window can take, and only that window can answer: the editor
//! hears that an agent is waiting, never the question's handle.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};
use tokio::sync::oneshot;

/// The permission window's label, which its capability and the answer command check.
pub const WINDOW: &str = "permission";
/// What the window hears when the questions change.
const CHANGED_EVENT: &str = "permission:changed";

/// What an agent asks.
#[derive(Clone, Debug, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Question {
    /// To run a tool: the request's `toolCall` and `options`, as ACP sends them.
    Tool { agent: String, params: Value },
    /// To switch to a mode in which it runs tools without asking.
    Mode { agent: String, mode: String },
    /// For an OpenPencil tool to read or write a file the caller named. `client` is the MCP
    /// client's own name, empty when it gave none.
    File {
        client: String,
        tool: String,
        write: bool,
        path: String,
    },
}

/// The person's answer.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Reply {
    /// One of the tool request's options, or `allow` for a mode.
    Chose(String),
    /// Refused: the window closed, the question timed out, or the person declined.
    Refused,
    /// The turn that asked was stopped.
    Cancelled,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Shown {
    id: u64,
    #[serde(flatten)]
    question: Question,
}

struct Pending {
    shown: Shown,
    process: u32,
    session: String,
    reply: oneshot::Sender<Reply>,
}

#[derive(Default)]
pub struct Permissions {
    next: AtomicU64,
    pending: Mutex<Vec<Pending>>,
}

impl Permissions {
    /// Queues a question from `process` and shows the window; the reply settles once answered.
    pub fn ask<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        question: Question,
        process: u32,
        session: String,
    ) -> (u64, oneshot::Receiver<Reply>) {
        let id = self.next.fetch_add(1, Ordering::Relaxed);
        let (reply, answer) = oneshot::channel();
        self.lock().push(Pending {
            shown: Shown { id, question },
            process,
            session,
            reply,
        });
        show(app);
        (id, answer)
    }

    /// Settles the question `id`, if it still waits.
    pub fn settle<R: Runtime>(&self, app: &AppHandle<R>, id: u64, reply: Reply) {
        self.settle_where(app, reply, |pending| pending.shown.id == id);
    }

    /// Cancels what `process` asks, in one session or all of them.
    pub fn cancel<R: Runtime>(&self, app: &AppHandle<R>, process: u32, session: Option<&str>) {
        self.settle_where(app, Reply::Cancelled, |pending| {
            pending.process == process && session.is_none_or(|session| pending.session == session)
        });
    }

    fn settle_where<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        reply: Reply,
        matches: impl Fn(&Pending) -> bool,
    ) {
        let (settled, empty) = {
            let mut pending = self.lock();
            let (settled, kept) = std::mem::take(&mut *pending).into_iter().partition(matches);
            *pending = kept;
            (settled, pending.is_empty())
        };
        let settled: Vec<Pending> = settled;
        if settled.is_empty() {
            return;
        }
        for pending in settled {
            let _ = pending.reply.send(reply.clone());
        }
        if empty {
            if let Some(window) = app.get_webview_window(WINDOW) {
                let _ = window.destroy();
            }
        } else {
            let _ = app.emit_to(WINDOW, CHANGED_EVENT, ());
        }
    }

    fn shown(&self) -> Vec<Shown> {
        self.lock()
            .iter()
            .map(|pending| pending.shown.clone())
            .collect()
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, Vec<Pending>> {
        self.pending
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

/// Opens the window, or brings it forward and tells it the questions changed.
fn show<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(WINDOW) {
        let _ = app.emit_to(WINDOW, CHANGED_EVENT, ());
        let _ = window.unminimize();
        let _ = window.set_focus();
        return;
    }
    let built = WebviewWindowBuilder::new(app, WINDOW, WebviewUrl::App("pages/permission.html".into()))
        .title("OpenPencil")
        .inner_size(440.0, 420.0)
        .min_inner_size(360.0, 260.0)
        .always_on_top(true)
        .center()
        .focused(true)
        .build();
    match built {
        Ok(window) => {
            let app = app.clone();
            // Closing the window refuses whatever it still asks.
            window.on_window_event(move |event| {
                if matches!(event, tauri::WindowEvent::Destroyed) {
                    let permissions = app.state::<Permissions>();
                    permissions.settle_where(&app, Reply::Refused, |_| true);
                }
            });
        }
        Err(error) => {
            eprintln!("[permission] could not open the window: {error}");
            app.state::<Permissions>()
                .settle_where(app, Reply::Refused, |_| true);
        }
    }
}

fn from_window<R: Runtime>(webview: &tauri::Webview<R>) -> Result<(), String> {
    if webview.label() == WINDOW {
        Ok(())
    } else {
        Err("Only the permission window answers agents.".to_owned())
    }
}

/// The questions waiting, oldest first.
#[tauri::command]
pub fn permission_questions<R: Runtime>(
    webview: tauri::Webview<R>,
    permissions: tauri::State<'_, Permissions>,
) -> Result<Vec<Shown>, String> {
    from_window(&webview)?;
    Ok(permissions.shown())
}

/// Answers the question `id` with one of its options, or refuses it with none.
#[tauri::command]
pub fn permission_answer<R: Runtime>(
    app: AppHandle<R>,
    webview: tauri::Webview<R>,
    permissions: tauri::State<'_, Permissions>,
    id: u64,
    option: Option<String>,
) -> Result<(), String> {
    from_window(&webview)?;
    permissions.settle(&app, id, option.map_or(Reply::Refused, Reply::Chose));
    Ok(())
}
