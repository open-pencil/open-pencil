//! The operating system around the editor window: its WebView, environment, browser, and
//! window.

pub mod crash;
pub mod env;
pub mod opener;
#[cfg(target_os = "macos")]
pub mod window;
