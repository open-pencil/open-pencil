//! Finding the OpenPencil MCP server that agents connect to.

use super::path::search_dirs;

/// Name of the MCP entry point installed by `@open-pencil/mcp`.
const MCP_EXECUTABLE: &str = "openpencil-mcp-http";
/// Bound on the directories reported back to the settings diagnostics.
const MAX_REPORTED_SEARCH_DIRS: usize = 12;

fn push_unique_dir(dirs: &mut Vec<String>, dir: String) {
    if !dirs.contains(&dir) {
        dirs.push(dir);
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpLookup {
    available: bool,
    path: Option<String>,
    /// Existing directories that were searched, for diagnostics.
    searched: Vec<String>,
}

#[tauri::command]
pub fn mcp_lookup() -> McpLookup {
    let resolved = which::which(MCP_EXECUTABLE).ok();
    let path = resolved.as_ref().map(|p| p.display().to_string());
    let mut searched: Vec<String> = Vec::new();
    if let Some(dir) = resolved.as_ref().and_then(|p| p.parent()) {
        push_unique_dir(&mut searched, dir.display().to_string());
    }
    for dir in search_dirs() {
        push_unique_dir(&mut searched, dir.display().to_string());
    }
    searched.truncate(MAX_REPORTED_SEARCH_DIRS);
    McpLookup {
        available: resolved.is_some(),
        path,
        searched,
    }
}
