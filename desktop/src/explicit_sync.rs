//! Keep WebKitGTK's DMABUF renderer from disconnecting a Wayland session on NVIDIA.

use std::{ffi::OsStr, path::Path};

/// NVIDIA reads this when its EGL driver initializes.
const NV_DISABLE_EXPLICIT_SYNC: &str = "__NV_DISABLE_EXPLICIT_SYNC";

/// Present only while the NVIDIA kernel module is loaded: the closed module and the
/// NVIDIA Open kernel module. Both use the proprietary EGL userspace that commits a
/// `wp_linux_drm_syncobj_surface_v1` without an acquire point. Nouveau does not create it.
const NVIDIA_VERSION_FILE: &str = "/proc/driver/nvidia/version";

/// Value to assign [`NV_DISABLE_EXPLICIT_SYNC`], if any.
///
/// `None` leaves the variable untouched: the user already set it, or the proprietary
/// NVIDIA driver is not loaded. An empty existing value is still an override.
fn explicit_sync_override(
    existing: Option<&OsStr>,
    nvidia_version_file: &Path,
) -> Option<&'static str> {
    if existing.is_some() || !nvidia_version_file.is_file() {
        return None;
    }
    Some("1")
}

/// Set `__NV_DISABLE_EXPLICIT_SYNC=1` before the webview is created when the proprietary
/// NVIDIA driver is loaded and the variable is unset. NVIDIA reads the variable when EGL
/// initializes, which is after `run()` starts and before the webview exists. Hyprland
/// otherwise drops the client (`Gdk-Message: Error 71`, missing acquire timeline).
#[cfg(target_os = "linux")]
pub fn disable_nvidia_explicit_sync() {
    let existing = std::env::var_os(NV_DISABLE_EXPLICIT_SYNC);
    if let Some(value) = explicit_sync_override(existing.as_deref(), Path::new(NVIDIA_VERSION_FILE))
    {
        std::env::set_var(NV_DISABLE_EXPLICIT_SYNC, value);
    }
}

#[cfg(test)]
mod tests {
    use std::ffi::OsStr;

    use super::explicit_sync_override;

    fn scratch(name: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!(
            "open-pencil-explicit-sync-{name}-{}",
            std::process::id()
        ))
    }

    #[test]
    fn leaves_explicit_sync_unset_without_the_nvidia_driver() {
        let missing = scratch("missing");
        assert!(explicit_sync_override(None, &missing).is_none());

        let directory = scratch("directory");
        std::fs::create_dir_all(&directory).expect("create directory");
        assert!(explicit_sync_override(None, &directory).is_none());
        let _ = std::fs::remove_dir(&directory);
    }

    #[test]
    fn disables_explicit_sync_when_the_nvidia_driver_is_loaded() {
        let version_file = scratch("version");
        std::fs::write(&version_file, b"NVRM version: test\n").expect("write version file");
        assert_eq!(explicit_sync_override(None, &version_file), Some("1"));
        let _ = std::fs::remove_file(&version_file);
    }

    #[test]
    fn keeps_an_existing_explicit_sync_value() {
        let version_file = scratch("override");
        std::fs::write(&version_file, b"").expect("write version file");
        for existing in ["0", "1", ""] {
            assert!(
                explicit_sync_override(Some(OsStr::new(existing)), &version_file).is_none(),
                "{existing:?}"
            );
        }
        let _ = std::fs::remove_file(&version_file);
    }
}
