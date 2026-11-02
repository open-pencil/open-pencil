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

/// The displays GTK could open: a Wayland socket and an X server.
struct Displays {
    wayland: bool,
    x11: bool,
}

/// Whether GTK will open a Wayland display. It tries the backends `GDK_BACKEND` lists in order,
/// or Wayland and then X11 without it, and takes the first that opens. Wayland is tried even
/// without a socket in sight when it is the last choice left, so that case counts as Wayland.
fn wayland_session(gdk_backend: Option<&OsStr>, displays: &Displays) -> bool {
    let listed = gdk_backend
        .and_then(OsStr::to_str)
        .map(str::trim)
        .filter(|list| !list.is_empty())
        .unwrap_or("*");
    let backends: Vec<&str> = listed
        .split(',')
        .map(str::trim)
        .flat_map(|backend| match backend {
            "*" => vec!["wayland", "x11"],
            other => vec![other],
        })
        .collect();
    for (index, backend) in backends.iter().enumerate() {
        match *backend {
            "wayland" if displays.wayland || index == backends.len() - 1 => return true,
            "x11" if displays.x11 => return false,
            _ => {}
        }
    }
    false
}

/// What libwayland and Xlib would connect to: `WAYLAND_DISPLAY`, or `wayland-0` in the runtime
/// directory without it, and `DISPLAY`.
#[cfg(target_os = "linux")]
fn displays() -> Displays {
    let set = |name: &str| std::env::var_os(name).is_some_and(|value| !value.is_empty());
    let default_socket = std::env::var_os("XDG_RUNTIME_DIR")
        .is_some_and(|dir| std::path::Path::new(&dir).join("wayland-0").exists());
    Displays {
        wayland: set("WAYLAND_DISPLAY") || default_socket,
        x11: set("DISPLAY"),
    }
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
        wayland: wayland_session(std::env::var_os("GDK_BACKEND").as_deref(), &displays()),
        webkit: webkit_version(),
    };
    if needs_workaround(&session) {
        std::env::set_var(NV_DISABLE_EXPLICIT_SYNC, "1");
    }
}

#[cfg(test)]
mod tests {
    use std::ffi::OsStr;

    use super::{needs_workaround, wayland_session, Displays, Session};

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
        let both = Displays {
            wayland: true,
            x11: true,
        };
        let x11_only = Displays {
            wayland: false,
            x11: true,
        };
        let wayland_only = Displays {
            wayland: true,
            x11: false,
        };
        let none = Displays {
            wayland: false,
            x11: false,
        };
        let backend = |list: &'static str| Some(OsStr::new(list));

        // Without GDK_BACKEND, or with `*`, GTK tries Wayland first, then X11.
        assert!(wayland_session(None, &both));
        assert!(wayland_session(backend("*"), &both));
        assert!(wayland_session(backend(""), &wayland_only));
        assert!(!wayland_session(None, &x11_only));
        // The list order wins, and a backend that cannot open falls through to the next.
        assert!(wayland_session(backend("wayland,x11"), &both));
        assert!(!wayland_session(backend("x11,wayland"), &both));
        assert!(wayland_session(backend("x11,wayland"), &wayland_only));
        assert!(!wayland_session(backend("wayland,x11"), &x11_only));
        assert!(!wayland_session(backend("x11"), &both));
        // Wayland as the last choice is tried with libwayland's default socket.
        assert!(wayland_session(backend("wayland"), &none));
        assert!(wayland_session(backend("x11,wayland"), &none));
    }
}
