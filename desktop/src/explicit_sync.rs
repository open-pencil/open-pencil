//! Keep WebKitGTK from disconnecting a Wayland session on NVIDIA.
//!
//! `__NV_DISABLE_EXPLICIT_SYNC` stops the proprietary EGL driver from committing a
//! syncobj surface without an acquire point. That is not enough on Hyprland: WebKitGTK
//! still builds a hardware DMABUF renderer, and the compositor drops the client
//! (`Gdk-Message: Error 71`). `WEBKIT_DMABUF_RENDERER_FORCE_SHM` keeps the shared-memory
//! transport, so compositing stays available and WebKit never creates the EGL window
//! surface that commits `wp_linux_drm_syncobj_surface_v1`. `WEBKIT_DISABLE_DMABUF_RENDERER`
//! would leave the transport mode empty and turn compositing off. WebKit reads the
//! shared-memory flag when it selects the backing store, after `run()` starts.

use std::{ffi::OsStr, path::Path};

/// NVIDIA reads this when its EGL driver initializes.
const NV_DISABLE_EXPLICIT_SYNC: &str = "__NV_DISABLE_EXPLICIT_SYNC";

/// WebKitGTK reads this when it selects the backing-store transport.
const WEBKIT_DMABUF_RENDERER_FORCE_SHM: &str = "WEBKIT_DMABUF_RENDERER_FORCE_SHM";

/// Present only while the NVIDIA kernel module is loaded: the closed module and the
/// NVIDIA Open kernel module. Both use the proprietary EGL userspace that commits a
/// `wp_linux_drm_syncobj_surface_v1` without an acquire point. Nouveau does not create it.
const NVIDIA_VERSION_FILE: &str = "/proc/driver/nvidia/version";

/// Value to assign one NVIDIA Wayland workaround, if any.
///
/// `None` leaves that variable untouched: the user already set it, or the proprietary
/// NVIDIA driver is not loaded. An empty existing value is still an override.
/// Both [`NV_DISABLE_EXPLICIT_SYNC`] and [`WEBKIT_DMABUF_RENDERER_FORCE_SHM`] use this.
fn nvidia_workaround(existing: Option<&OsStr>, nvidia_version_file: &Path) -> Option<&'static str> {
    if existing.is_some() || !nvidia_version_file.is_file() {
        return None;
    }
    Some("1")
}

/// Set the NVIDIA Wayland workarounds before the webview is created when the proprietary
/// driver is loaded and each variable is unset. NVIDIA reads `__NV_DISABLE_EXPLICIT_SYNC`
/// when EGL initializes, and WebKit reads `WEBKIT_DMABUF_RENDERER_FORCE_SHM` when it
/// selects the backing-store transport. Both happen after `run()` starts and before the
/// window maps.
#[cfg(target_os = "linux")]
pub fn disable_nvidia_explicit_sync() {
    let version_file = Path::new(NVIDIA_VERSION_FILE);
    for variable in [NV_DISABLE_EXPLICIT_SYNC, WEBKIT_DMABUF_RENDERER_FORCE_SHM] {
        let existing = std::env::var_os(variable);
        if let Some(value) = nvidia_workaround(existing.as_deref(), version_file) {
            std::env::set_var(variable, value);
        }
    }
}

#[cfg(test)]
mod tests {
    use std::ffi::OsStr;

    use super::nvidia_workaround;

    fn scratch(name: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!(
            "open-pencil-explicit-sync-{name}-{}",
            std::process::id()
        ))
    }

    #[test]
    fn leaves_the_workaround_unset_without_the_nvidia_driver() {
        let missing = scratch("missing");
        assert!(nvidia_workaround(None, &missing).is_none());

        let directory = scratch("directory");
        std::fs::create_dir_all(&directory).expect("create directory");
        assert!(nvidia_workaround(None, &directory).is_none());
        let _ = std::fs::remove_dir(&directory);
    }

    #[test]
    fn enables_the_workaround_when_the_nvidia_driver_is_loaded() {
        let version_file = scratch("version");
        std::fs::write(&version_file, b"NVRM version: test\n").expect("write version file");
        assert_eq!(nvidia_workaround(None, &version_file), Some("1"));
        let _ = std::fs::remove_file(&version_file);
    }

    #[test]
    fn keeps_an_existing_workaround_value() {
        let version_file = scratch("override");
        std::fs::write(&version_file, b"").expect("write version file");
        for existing in ["0", "1", ""] {
            assert!(
                nvidia_workaround(Some(OsStr::new(existing)), &version_file).is_none(),
                "{existing:?}"
            );
        }
        let _ = std::fs::remove_file(&version_file);
    }
}
