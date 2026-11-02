//! Keep WebKitGTK before 2.54.2 from crashing a Wayland session on NVIDIA.
//!
//! Those versions create the window's first GL context in the middle of a GTK 3 frame. GDK then
//! creates the EGL window surface, NVIDIA's EGL platform turns on explicit sync for it, and the
//! frame is still committed from shared memory without an acquire point. Every compositor that
//! enforces `wp_linux_drm_syncobj_surface_v1` disconnects the app at its first paint
//! (`Gdk-Message: Error 71`). WebKit fixed it in 2.54.2
//! (<https://bugs.webkit.org/show_bug.cgi?id=324551>); the AppImage bundles an older WebKitGTK,
//! and so do current distributions.
//!
//! `__NV_DISABLE_EXPLICIT_SYNC=1` avoids the error and keeps WebKit's DMABUF renderer. It is set
//! only where the crash can happen, so fixed systems keep explicit sync.
// The decision is plain logic its tests check on every platform; only Linux applies it.
#![cfg_attr(not(target_os = "linux"), allow(dead_code))]

use std::ffi::OsStr;

/// NVIDIA reads this when its EGL platform initializes, after `run()` starts.
const NV_DISABLE_EXPLICIT_SYNC: &str = "__NV_DISABLE_EXPLICIT_SYNC";

/// Present while the NVIDIA kernel module is loaded, closed or open; nouveau does not create it.
#[cfg(target_os = "linux")]
const NVIDIA_VERSION_FILE: &str = "/proc/driver/nvidia/version";

/// The first WebKitGTK release with the fix.
const FIXED_WEBKIT: (u32, u32, u32) = (2, 54, 2);

/// What decides whether the app turns explicit sync off.
struct Session<'a> {
    /// The variable as the person launched the app with it.
    existing: Option<&'a OsStr>,
    nvidia: bool,
    wayland: bool,
    webkit: (u32, u32, u32),
}

fn needs_workaround(session: &Session) -> bool {
    session.existing.is_none() && session.nvidia && session.wayland && session.webkit < FIXED_WEBKIT
}

/// Whether GTK will open a Wayland display: `GDK_BACKEND` names the backend it tries first,
/// and without it GTK uses Wayland when the session has one.
fn wayland_session(
    gdk_backend: Option<&OsStr>,
    wayland_display: Option<&OsStr>,
    session_type: Option<&OsStr>,
) -> bool {
    if let Some(backend) = gdk_backend.and_then(OsStr::to_str) {
        let first = backend.split(',').next().unwrap_or_default().trim();
        if !first.is_empty() && first != "*" && first != "wayland" {
            return false;
        }
    }
    wayland_display.is_some_and(|display| !display.is_empty())
        || session_type.is_some_and(|kind| kind == "wayland")
}

/// The WebKitGTK the app has loaded, which for the AppImage is the bundled one.
#[cfg(target_os = "linux")]
fn webkit_version() -> (u32, u32, u32) {
    // SAFETY: these return constants of the loaded library and need no initialization.
    unsafe {
        (
            webkit2gtk_sys::webkit_get_major_version(),
            webkit2gtk_sys::webkit_get_minor_version(),
            webkit2gtk_sys::webkit_get_micro_version(),
        )
    }
}

/// Turn NVIDIA's explicit sync off before the webview is created, when an affected WebKitGTK
/// would otherwise draw on Wayland with the NVIDIA driver. A value the person set is kept.
#[cfg(target_os = "linux")]
pub fn disable_nvidia_explicit_sync() {
    let existing = std::env::var_os(NV_DISABLE_EXPLICIT_SYNC);
    let session = Session {
        existing: existing.as_deref(),
        nvidia: std::path::Path::new(NVIDIA_VERSION_FILE).is_file(),
        wayland: wayland_session(
            std::env::var_os("GDK_BACKEND").as_deref(),
            std::env::var_os("WAYLAND_DISPLAY").as_deref(),
            std::env::var_os("XDG_SESSION_TYPE").as_deref(),
        ),
        webkit: webkit_version(),
    };
    if needs_workaround(&session) {
        std::env::set_var(NV_DISABLE_EXPLICIT_SYNC, "1");
    }
}

#[cfg(test)]
mod tests {
    use std::ffi::OsStr;

    use super::{needs_workaround, wayland_session, Session};

    fn affected() -> Session<'static> {
        Session {
            existing: None,
            nvidia: true,
            wayland: true,
            webkit: (2, 50, 4),
        }
    }

    #[test]
    fn turns_explicit_sync_off_only_where_the_crash_happens() {
        assert!(needs_workaround(&affected()));
        assert!(needs_workaround(&Session {
            webkit: (2, 54, 1),
            ..affected()
        }));
        assert!(!needs_workaround(&Session {
            nvidia: false,
            ..affected()
        }));
        assert!(!needs_workaround(&Session {
            wayland: false,
            ..affected()
        }));
        for fixed in [(2, 54, 2), (2, 54, 3), (2, 56, 0)] {
            assert!(!needs_workaround(&Session {
                webkit: fixed,
                ..affected()
            }));
        }
    }

    #[test]
    fn keeps_a_value_the_person_set() {
        for existing in ["0", "1", ""] {
            assert!(!needs_workaround(&Session {
                existing: Some(OsStr::new(existing)),
                ..affected()
            }));
        }
    }

    #[test]
    fn follows_the_backend_gtk_opens() {
        let wayland = Some(OsStr::new("wayland-1"));
        assert!(wayland_session(None, wayland, None));
        assert!(wayland_session(None, None, Some(OsStr::new("wayland"))));
        assert!(wayland_session(
            Some(OsStr::new("wayland,x11")),
            wayland,
            None
        ));
        assert!(wayland_session(Some(OsStr::new("*")), wayland, None));
        assert!(!wayland_session(Some(OsStr::new("x11")), wayland, None));
        assert!(!wayland_session(None, None, Some(OsStr::new("x11"))));
        assert!(!wayland_session(None, Some(OsStr::new("")), None));
    }
}
