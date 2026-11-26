//! A program's standard input. One thread per program writes what was queued, in the order it
//! was queued, apart from the process table: a program that stops reading blocks only its own
//! writes, never a Stop or another program.

use std::sync::mpsc;
use std::sync::{Arc, Mutex};

use tauri_plugin_shell::process::CommandChild;
use tokio::sync::oneshot;

/// The outcome of a queued write, once the program took it or failed to.
pub type Written = oneshot::Receiver<Result<(), String>>;

const STOPPED: &str = "The program has stopped.";

struct Write {
    bytes: Vec<u8>,
    done: oneshot::Sender<Result<(), String>>,
}

#[derive(Clone)]
pub struct Input {
    child: Arc<Mutex<Option<CommandChild>>>,
    queue: mpsc::Sender<Write>,
}

impl Input {
    pub fn new(child: CommandChild) -> Self {
        let child = Arc::new(Mutex::new(Some(child)));
        let (queue, writes) = mpsc::channel::<Write>();
        let writer = Arc::clone(&child);
        // Ends once every handle to the queue is gone, with the program's entry.
        std::thread::spawn(move || {
            for write in writes {
                let _ = write.done.send(write_to(&writer, &write.bytes));
            }
        });
        Self { child, queue }
    }

    /// Queues whole lines, each ending in `\n`, as one write: a failure stops the rest.
    pub fn lines(&self, lines: Vec<String>) -> Written {
        let mut bytes = Vec::new();
        for line in lines {
            bytes.extend_from_slice(line.as_bytes());
            bytes.push(b'\n');
        }
        self.bytes(bytes)
    }

    /// Queues whole lines no one waits on, such as an answer to the program: a failed write
    /// shows as the program ending.
    pub fn send(&self, lines: Vec<String>) {
        drop(self.lines(lines));
    }

    /// Queues bytes as they are.
    pub fn bytes(&self, bytes: Vec<u8>) -> Written {
        let (done, written) = oneshot::channel();
        if bytes.is_empty() {
            let _ = done.send(Ok(()));
        } else if let Err(mpsc::SendError(write)) = self.queue.send(Write { bytes, done }) {
            let _ = write.done.send(Err(STOPPED.to_owned()));
        }
        written
    }

    /// Takes the program's handle to kill it, unless a write blocked on it holds the handle.
    pub fn take(&self) -> Option<CommandChild> {
        match self.child.try_lock() {
            Ok(mut child) => child.take(),
            Err(_) => None,
        }
    }
}

fn write_to(child: &Mutex<Option<CommandChild>>, bytes: &[u8]) -> Result<(), String> {
    let mut child = child
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    child
        .as_mut()
        .ok_or_else(|| STOPPED.to_owned())?
        .write(bytes)
        .map_err(|e| e.to_string())
}

/// The outcome of a write the caller waits for.
pub async fn written(written: Written) -> Result<(), String> {
    written.await.unwrap_or_else(|_| Err(STOPPED.to_owned()))
}
