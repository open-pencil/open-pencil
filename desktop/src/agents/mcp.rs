//! Finding the OpenPencil MCP server that agents connect to.

use std::path::{Path, PathBuf};

use super::path::search_dirs;

/// Name of the MCP entry point installed by `@open-pencil/mcp`.
const MCP_EXECUTABLE: &str = "openpencil-mcp-http";
/// Bound on the directories reported back to the settings diagnostics.
const MAX_REPORTED_SEARCH_DIRS: usize = 12;
/// Environment variable the AppImage runtime sets to its mount directory.
const APPDIR_ENV: &str = "APPDIR";
/// Library path the AppImage runtime extends with its bundled libraries.
const LD_LIBRARY_PATH_ENV: &str = "LD_LIBRARY_PATH";

/// Removes the AppImage mount directory from an `LD_LIBRARY_PATH` value.
///
/// The AppImage runtime prepends its mount directory's `usr/lib` to
/// `LD_LIBRARY_PATH`, so a host binary a spawned child runs loads the bundled
/// `libsystemd.so.0` instead of the host's and dies on a missing version
/// (issue #2250). Entries equal to the mount directory or below it are
/// dropped; every other entry is kept verbatim and in order. Returns `None`
/// when nothing was removed, so callers leave the variable alone.
fn sanitize_ld_library_path(ld_library_path: &str, appdir: &Path) -> Option<String> {
    let mut kept: Vec<&str> = Vec::new();
    let mut removed = false;
    for entry in ld_library_path.split(':') {
        if Path::new(entry).starts_with(appdir) {
            removed = true;
        } else {
            kept.push(entry);
        }
    }
    if !removed {
        return None;
    }
    Some(kept.join(":"))
}

/// The `LD_LIBRARY_PATH` the MCP server should be spawned with, or `None`
/// when the current one needs no change.
///
/// Reads the AppImage mount directory from `APPDIR` (set by the AppImage
/// runtime) and strips its entries from `LD_LIBRARY_PATH`. Outside an
/// AppImage, or when the variable holds no mount entries, this is `None`.
fn sanitized_ld_library_path() -> Option<String> {
    let appdir = std::env::var_os(APPDIR_ENV).map(PathBuf::from)?;
    // An empty APPDIR would match every entry as a path prefix, so treat it
    // as unset rather than stripping the whole variable.
    if appdir.as_os_str().is_empty() {
        return None;
    }
    let current = std::env::var(LD_LIBRARY_PATH_ENV).ok()?;
    sanitize_ld_library_path(&current, &appdir)
}

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
    /// `LD_LIBRARY_PATH` with the AppImage mount entries removed, when the
    /// current value has any. The frontend passes it to the spawned server
    /// so host binaries in its process tree load the host's libraries.
    ld_library_path: Option<String>,
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
        ld_library_path: sanitized_ld_library_path(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_removes_mount_entries_and_keeps_the_rest_in_order() {
        assert_eq!(
            sanitize_ld_library_path(
                "/tmp/.mount_OpenPe1234/usr/lib:/usr/lib/x86_64-linux-gnu:/tmp/.mount_OpenPe1234/usr/lib64",
                Path::new("/tmp/.mount_OpenPe1234")
            ),
            Some("/usr/lib/x86_64-linux-gnu".to_string())
        );
    }

    #[test]
    fn sanitize_removes_the_mount_directory_itself() {
        assert_eq!(
            sanitize_ld_library_path(
                "/tmp/.mount_OpenPe1234:/usr/lib",
                Path::new("/tmp/.mount_OpenPe1234")
            ),
            Some("/usr/lib".to_string())
        );
    }

    #[test]
    fn sanitize_returns_none_when_no_entry_is_under_the_mount() {
        assert_eq!(
            sanitize_ld_library_path("/usr/lib:/opt/lib", Path::new("/tmp/.mount_OpenPe1234")),
            None
        );
    }

    #[test]
    fn sanitize_keeps_a_sibling_that_only_shares_a_name_prefix() {
        assert_eq!(
            sanitize_ld_library_path(
                "/tmp/.mount_OpenPe12345/usr/lib:/usr/lib",
                Path::new("/tmp/.mount_OpenPe1234")
            ),
            None
        );
    }

    #[test]
    fn sanitize_returns_an_empty_value_when_every_entry_is_under_the_mount() {
        assert_eq!(
            sanitize_ld_library_path(
                "/tmp/.mount_OpenPe1234/usr/lib",
                Path::new("/tmp/.mount_OpenPe1234")
            ),
            Some(String::new())
        );
    }
}
