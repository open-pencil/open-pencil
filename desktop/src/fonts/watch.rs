//! Lists the system fonts again when they change, so a font installed or removed while the app
//! runs shows in the font picker and loads without a restart. Three signals say so: the font
//! folders changing on every platform; on macOS, Core Text's notification, which also covers
//! fonts a font manager activates from its own folders; and on Windows, the `WM_FONTCHANGE` an
//! app broadcasts after it adds or removes fonts. Signals that come close together are read as
//! one, and the fonts are listed once they stop.

use notify::{RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::mpsc::{channel, RecvTimeoutError, Sender};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use tauri::{AppHandle, Emitter, WebviewWindow};

use super::catalog;

/// The event the frontend reloads its font list on.
pub const FONTS_CHANGED_EVENT: &str = "fonts:changed";

/// How long the signals must stop before the fonts are listed again: an installer copies files
/// one by one, and Windows' font cache takes a moment to see a new file.
const QUIET: Duration = Duration::from_millis(750);

static SIGNALS: OnceLock<Mutex<Sender<()>>> = OnceLock::new();

fn signal() {
    if let Some(signals) = SIGNALS.get() {
        let _ = signals
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .send(());
    }
}

/// Starts listening for font changes; the main window receives Windows' broadcast.
pub fn start(app: &AppHandle, window: &WebviewWindow) {
    let (sender, signals) = channel();
    if SIGNALS.set(Mutex::new(sender)).is_err() {
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        while signals.recv().is_ok() {
            loop {
                match signals.recv_timeout(QUIET) {
                    Ok(()) => continue,
                    Err(RecvTimeoutError::Timeout) => break,
                    Err(RecvTimeoutError::Disconnected) => return,
                }
            }
            #[cfg(windows)]
            win32::check_for_updates();
            catalog::rescan();
            // Listed here, off the frontend's request, so the picker reloads a ready list.
            let _ = catalog::families();
            let _ = app.emit(FONTS_CHANGED_EVENT, ());
        }
    });

    watch_folders();
    #[cfg(target_os = "macos")]
    macos::observe();
    #[cfg(windows)]
    win32::observe(window);
    #[cfg(not(windows))]
    let _ = window;
}

fn watch_folders() {
    let watcher = notify::recommended_watcher(|event: notify::Result<notify::Event>| {
        if event.is_ok_and(|event| !event.kind.is_access()) {
            signal();
        }
    });
    let Ok(mut watcher) = watcher else {
        return;
    };
    for folder in font_folders().into_iter().filter(|folder| folder.is_dir()) {
        let _ = watcher.watch(&folder, RecursiveMode::Recursive);
    }
    // Watches for as long as the app runs.
    std::mem::forget(watcher);
}

/// The folders fonts are installed into.
fn font_folders() -> Vec<PathBuf> {
    let env = |name: &str| std::env::var_os(name).map(PathBuf::from);
    let mut folders = Vec::new();
    #[cfg(windows)]
    {
        folders.extend(env("WINDIR").map(|windows| windows.join("Fonts")));
        folders.extend(env("LOCALAPPDATA").map(|local| local.join("Microsoft/Windows/Fonts")));
    }
    #[cfg(target_os = "macos")]
    {
        folders.push(PathBuf::from("/Library/Fonts"));
        folders.extend(env("HOME").map(|home| home.join("Library/Fonts")));
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        folders.push(PathBuf::from("/usr/share/fonts"));
        folders.push(PathBuf::from("/usr/local/share/fonts"));
        let data =
            env("XDG_DATA_HOME").or_else(|| env("HOME").map(|home| home.join(".local/share")));
        folders.extend(data.map(|data| data.join("fonts")));
        folders.extend(env("HOME").map(|home| home.join(".fonts")));
    }
    folders
}

#[cfg(target_os = "macos")]
mod macos {
    use objc2_core_foundation::{
        CFDictionary, CFNotificationCenter, CFNotificationName, CFNotificationSuspensionBehavior,
    };
    use objc2_core_text::kCTFontManagerRegisteredFontsChangedNotification;
    use std::ffi::c_void;
    use std::ptr;

    unsafe extern "C-unwind" fn changed(
        _center: *mut CFNotificationCenter,
        _observer: *mut c_void,
        _name: *const CFNotificationName,
        _object: *const c_void,
        _info: *const CFDictionary,
    ) {
        super::signal();
    }

    /// Core Text posts fonts registered for the user or the session to the distributed center.
    pub fn observe() {
        let Some(center) = CFNotificationCenter::distributed_center() else {
            return;
        };
        // SAFETY: the callback reads none of its arguments, and the observer stays registered
        // for as long as the app runs.
        unsafe {
            center.add_observer(
                ptr::null(),
                Some(changed),
                Some(kCTFontManagerRegisteredFontsChangedNotification),
                ptr::null(),
                CFNotificationSuspensionBehavior::DeliverImmediately,
            );
        }
    }
}

#[cfg(windows)]
mod win32 {
    use tauri::WebviewWindow;
    use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
    use windows::Win32::Graphics::DirectWrite::{
        DWriteCreateFactory, IDWriteFactory, IDWriteFontCollection, DWRITE_FACTORY_TYPE_SHARED,
    };
    use windows::Win32::UI::Shell::{DefSubclassProc, SetWindowSubclass};
    use windows::Win32::UI::WindowsAndMessaging::WM_FONTCHANGE;

    const SUBCLASS: usize = 0x666f6e74;

    unsafe extern "system" fn procedure(
        window: HWND,
        message: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        _id: usize,
        _data: usize,
    ) -> LRESULT {
        if message == WM_FONTCHANGE {
            super::signal();
        }
        // SAFETY: forwards the message to the window's own procedure unchanged.
        unsafe { DefSubclassProc(window, message, wparam, lparam) }
    }

    /// Apps broadcast `WM_FONTCHANGE` to every top-level window after they add or remove fonts.
    pub fn observe(window: &WebviewWindow) {
        let Ok(handle) = window.hwnd() else {
            return;
        };
        // SAFETY: the window outlives the subclass, which is removed with it.
        unsafe {
            let _ = SetWindowSubclass(HWND(handle.0), Some(procedure), SUBCLASS, 0);
        }
    }

    /// Has DirectWrite look for new fonts now. fontique asks the shared factory without that
    /// check, and then sees a new font only once the font cache service gets to it: 530 ms
    /// after the file appeared on a Windows 11 VM, against 200 ms with it.
    pub fn check_for_updates() {
        // SAFETY: plain COM calls on the shared factory, whose collection fontique then gets.
        unsafe {
            let Ok(factory) = DWriteCreateFactory::<IDWriteFactory>(DWRITE_FACTORY_TYPE_SHARED)
            else {
                return;
            };
            let mut collection: Option<IDWriteFontCollection> = None;
            let _ = factory.GetSystemFontCollection(&mut collection, true);
        }
    }
}
