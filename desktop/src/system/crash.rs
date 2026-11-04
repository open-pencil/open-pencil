//! The last Rust panic, kept on disk so the next launch can offer to report it.

use std::fs;
use std::panic::PanicHookInfo;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::Manager;

const FILE_NAME: &str = "last-panic.json";
const MAX_MESSAGE_CHARS: usize = 2000;

/// A panic as the frontend reports it: its message and where in the source it happened.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PanicRecord {
    pub message: String,
    pub location: Option<String>,
    pub version: String,
}

fn panic_message(info: &PanicHookInfo<'_>) -> String {
    let payload = info.payload();
    let message = payload
        .downcast_ref::<&str>()
        .map(|text| (*text).to_string())
        .or_else(|| payload.downcast_ref::<String>().cloned())
        .unwrap_or_else(|| "panic".to_string());
    message.chars().take(MAX_MESSAGE_CHARS).collect()
}

fn write_record(directory: &Path, record: &PanicRecord) {
    let Ok(json) = serde_json::to_vec(record) else {
        return;
    };
    // Best effort: a panic hook must never panic itself.
    let _ = fs::create_dir_all(directory);
    let _ = fs::write(directory.join(FILE_NAME), json);
}

/// Reads and removes the record, so each panic is offered once. A record that cannot be removed
/// is not offered, as every later launch would offer it again.
fn take_record(directory: &Path) -> Option<PanicRecord> {
    let path = directory.join(FILE_NAME);
    let bytes = fs::read(&path).ok()?;
    fs::remove_file(&path).ok()?;
    serde_json::from_slice(&bytes).ok()
}

/// Records every panic in the app's data folder, after the default hook has printed it.
pub fn install_panic_hook(directory: PathBuf, version: String) {
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        previous(info);
        let record = PanicRecord {
            message: panic_message(info),
            location: info.location().map(|location| {
                format!(
                    "{}:{}:{}",
                    location.file(),
                    location.line(),
                    location.column()
                )
            }),
            version: version.clone(),
        };
        write_record(&directory, &record);
    }));
}

/// The panic the last run recorded, if any; it is removed once read.
#[tauri::command]
pub fn take_last_panic(app: tauri::AppHandle) -> Option<PanicRecord> {
    take_record(&app.path().app_data_dir().ok()?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_recorded_panic_is_taken_once() {
        let directory =
            std::env::temp_dir().join(format!("openpencil-crash-{}", std::process::id()));
        let record = PanicRecord {
            message: "index out of bounds".into(),
            location: Some("src/menu/mod.rs:12:5".into()),
            version: "0.17.0".into(),
        };
        write_record(&directory, &record);

        assert_eq!(take_record(&directory), Some(record));
        assert_eq!(take_record(&directory), None);
        let _ = fs::remove_dir_all(directory);
    }
}
