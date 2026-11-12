//! Features a package switches off in its launcher environment, so the app never asks which
//! package it came from: a Snap or Flatpak sets both to `0`, an AUR or Nix package only
//! `OPENPENCIL_SELF_UPDATE`. Unset keeps a feature on, as in the GitHub release builds.

use std::ffi::OsStr;

use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime};

/// The built-in updater: its plugin, the startup check, and the macOS menu item.
const SELF_UPDATE_ENV: &str = "OPENPENCIL_SELF_UPDATE";
/// Spawning host programs: ACP agents, `npm` installs, the MCP server, and the Pi harness.
const HOST_PROCESSES_ENV: &str = "OPENPENCIL_HOST_PROCESSES";

/// Shell spawn permissions, left out of `app.security.capabilities` and granted at startup.
const HOST_PROCESSES_CAPABILITY: &str = include_str!("../capabilities/host-processes.json");

/// What a command that starts a program answers when the build switched host processes off.
const HOST_PROCESSES_OFF: &str = "this build of the app does not run other programs";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopCapabilities {
    pub self_update: bool,
    pub host_processes: bool,
}

impl DesktopCapabilities {
    pub fn from_env() -> Self {
        Self {
            self_update: env_flag(SELF_UPDATE_ENV),
            host_processes: env_flag(HOST_PROCESSES_ENV),
        }
    }

    /// Refuse a command that starts a host program in a build that may not start any. The webview
    /// loses its shell scope with the switch, but the app's own commands are reachable all the
    /// same, and each of them checks here rather than trusting that scope to be the only way in.
    pub fn require_host_processes(&self) -> Result<(), String> {
        if self.host_processes {
            Ok(())
        } else {
            Err(HOST_PROCESSES_OFF.to_owned())
        }
    }

    /// The main window's script that `src/app/tauri/capabilities.ts` reads before any other.
    pub fn init_script(&self) -> String {
        let json = serde_json::to_string(self).expect("two booleans serialize");
        format!("window.__OPENPENCIL_DESKTOP_CAPABILITIES__ = Object.freeze({json});")
    }

    /// Grants the shell spawn scope, without which the webview can start no host program.
    pub fn grant<R: Runtime>(&self, app: &AppHandle<R>) -> tauri::Result<()> {
        if self.host_processes {
            app.add_capability(HOST_PROCESSES_CAPABILITY)?;
        }
        Ok(())
    }
}

fn env_flag(name: &str) -> bool {
    enabled(name, std::env::var_os(name).as_deref())
}

/// Unset or empty keeps a feature on. Anything but a clear "on" turns it off, including a typo
/// or a value that is not Unicode: a package sets the variable only to change the default.
fn enabled(name: &str, value: Option<&OsStr>) -> bool {
    let Some(value) = value else { return true };
    match value
        .to_str()
        .map(|text| text.trim().to_ascii_lowercase())
        .as_deref()
    {
        Some("" | "1" | "true" | "yes" | "on") => true,
        Some("0" | "false" | "no" | "off") => false,
        _ => {
            eprintln!("[capabilities] unrecognized {name}={value:?}; turning it off");
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri::utils::acl::capability::CapabilityFile;

    fn read(value: Option<&str>) -> bool {
        enabled("TEST", value.map(OsStr::new))
    }

    #[test]
    fn unset_and_on_values_keep_a_feature_on() {
        for value in [None, Some(""), Some("1"), Some(" TRUE "), Some("on")] {
            assert!(read(value), "{value:?}");
        }
    }

    #[test]
    fn off_and_unrecognized_values_turn_it_off() {
        for value in [Some("0"), Some("False"), Some(" no "), Some("fasle")] {
            assert!(!read(value), "{value:?}");
        }
    }

    #[cfg(unix)]
    #[test]
    fn a_value_that_is_not_unicode_turns_it_off() {
        use std::os::unix::ffi::OsStrExt;
        assert!(!enabled("TEST", Some(OsStr::from_bytes(b"\xff"))));
    }

    #[test]
    fn the_init_script_freezes_the_camel_case_values() {
        let capabilities = DesktopCapabilities {
            self_update: false,
            host_processes: true,
        };
        assert_eq!(
            capabilities.init_script(),
            r#"window.__OPENPENCIL_DESKTOP_CAPABILITIES__ = Object.freeze({"selfUpdate":false,"hostProcesses":true});"#
        );
    }

    #[test]
    fn the_host_processes_capability_targets_the_main_window() {
        let Ok(CapabilityFile::Capability(capability)) = HOST_PROCESSES_CAPABILITY.parse() else {
            panic!("host-processes.json holds one valid capability");
        };
        assert_eq!(capability.identifier, "host-processes");
        assert_eq!(capability.windows, ["main"]);
    }

    #[test]
    fn a_build_without_host_processes_refuses_what_starts_one() {
        let off = DesktopCapabilities {
            self_update: true,
            host_processes: false,
        };
        assert_eq!(
            off.require_host_processes(),
            Err("this build of the app does not run other programs".to_owned())
        );

        let on = DesktopCapabilities {
            self_update: false,
            host_processes: true,
        };
        assert!(on.require_host_processes().is_ok());
    }
}
