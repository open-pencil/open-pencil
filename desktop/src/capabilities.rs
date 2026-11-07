//! Features a package can switch off for the installs it ships.
//!
//! A store or distro package sets these in its launcher environment, so the app never
//! asks which package it came from: a Snap or Flatpak turns off both, an AUR or Nix
//! package turns off self-update. Unset means on, which is what the GitHub release
//! builds ship.

use serde::Serialize;
use tauri::{
    plugin::{Builder as PluginBuilder, TauriPlugin},
    Runtime,
};

/// `0` turns off the built-in updater: its plugin, the startup check, the Software
/// Update window, and the macOS menu item. Packages whose store delivers updates set it.
pub const SELF_UPDATE_ENV: &str = "OPENPENCIL_SELF_UPDATE";
/// `0` stops the app from spawning programs on the host: ACP agents, `npm` installs,
/// the MCP server, and the Pi harness. Sandboxed packages that cannot reach host
/// binaries set it.
pub const HOST_PROCESSES_ENV: &str = "OPENPENCIL_HOST_PROCESSES";

/// The name the frontend reads the capabilities from (`src/app/tauri/capabilities.ts`).
const WINDOW_GLOBAL: &str = "__OPENPENCIL_DESKTOP_CAPABILITIES__";

/// The shell permissions that spawn host programs, granted only when allowed.
const HOST_PROCESSES_CAPABILITY: &str = include_str!("../capabilities/host-processes.json");

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopCapabilities {
    pub self_update: bool,
    pub host_processes: bool,
}

impl DesktopCapabilities {
    pub fn from_env() -> Self {
        // `var_os`, not `var`: a value that is not Unicode must read as unrecognized, which
        // turns the feature off, not as unset, which would leave it on.
        Self::from_lookup(|name| {
            std::env::var_os(name).map(|value| value.to_string_lossy().into_owned())
        })
    }

    fn from_lookup(lookup: impl Fn(&str) -> Option<String>) -> Self {
        Self {
            self_update: flag(SELF_UPDATE_ENV, lookup(SELF_UPDATE_ENV)),
            host_processes: flag(HOST_PROCESSES_ENV, lookup(HOST_PROCESSES_ENV)),
        }
    }

    /// Defines the read-only window global before any page script runs, in every webview.
    fn init_script(&self) -> String {
        let value = serde_json::to_string(self).expect("capabilities serialize to JSON");
        format!(
            "Object.defineProperty(window, '{WINDOW_GLOBAL}', \
             {{ value: Object.freeze({value}), enumerable: false }});"
        )
    }
}

/// Unset or empty keeps a feature on. A value that is not clearly "on" turns it off:
/// a package only sets the variable to change the default, so a typo must not leave
/// a sandbox spawning host programs.
fn flag(name: &str, value: Option<String>) -> bool {
    let Some(value) = value else { return true };
    match value.trim().to_ascii_lowercase().as_str() {
        "" | "1" | "true" | "yes" | "on" => true,
        "0" | "false" | "no" | "off" => false,
        other => {
            eprintln!("[capabilities] {name}={other:?} is not a recognized value; turning it off");
            false
        }
    }
}

/// Exposes the capabilities to the frontend without an IPC round trip, so modules can
/// read them synchronously at import time.
pub fn plugin<R: Runtime>(capabilities: DesktopCapabilities) -> TauriPlugin<R> {
    PluginBuilder::new("desktop-capabilities")
        .js_init_script(capabilities.init_script())
        .build()
}

/// Grants the main window the shell spawn scope when host processes are allowed.
/// The capability is not listed in `app.security.capabilities`, so without this the
/// webview cannot spawn anything, whatever the frontend shows.
pub fn grant_host_processes<R: Runtime>(
    app: &tauri::AppHandle<R>,
    capabilities: DesktopCapabilities,
) -> tauri::Result<()> {
    if capabilities.host_processes {
        use tauri::Manager;
        app.add_capability(HOST_PROCESSES_CAPABILITY)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use tauri::utils::acl::capability::CapabilityFile;

    fn from(values: &[(&str, &str)]) -> DesktopCapabilities {
        let values: HashMap<String, String> = values
            .iter()
            .map(|(name, value)| ((*name).to_owned(), (*value).to_owned()))
            .collect();
        DesktopCapabilities::from_lookup(|name| values.get(name).cloned())
    }

    #[test]
    fn everything_is_on_when_nothing_is_set() {
        assert_eq!(
            from(&[]),
            DesktopCapabilities {
                self_update: true,
                host_processes: true
            }
        );
    }

    #[test]
    fn each_variable_turns_off_only_its_feature() {
        assert_eq!(
            from(&[(SELF_UPDATE_ENV, "0")]),
            DesktopCapabilities {
                self_update: false,
                host_processes: true
            }
        );
        assert_eq!(
            from(&[(HOST_PROCESSES_ENV, "false")]),
            DesktopCapabilities {
                self_update: true,
                host_processes: false
            }
        );
    }

    #[test]
    fn values_are_read_case_insensitively_and_trimmed() {
        assert!(!flag(SELF_UPDATE_ENV, Some(" OFF ".into())));
        assert!(!flag(SELF_UPDATE_ENV, Some("No".into())));
        assert!(flag(SELF_UPDATE_ENV, Some("TRUE".into())));
        assert!(flag(SELF_UPDATE_ENV, Some("".into())));
    }

    #[test]
    fn an_unrecognized_value_turns_the_feature_off() {
        assert!(!flag(HOST_PROCESSES_ENV, Some("fasle".into())));
    }

    #[test]
    fn the_init_script_defines_a_frozen_camel_case_global() {
        let script = DesktopCapabilities {
            self_update: false,
            host_processes: true,
        }
        .init_script();
        assert!(script.contains(WINDOW_GLOBAL));
        assert!(script.contains(r#"Object.freeze({"selfUpdate":false,"hostProcesses":true})"#));
    }

    #[test]
    fn the_host_processes_capability_parses_and_targets_the_main_window() {
        let file: CapabilityFile = HOST_PROCESSES_CAPABILITY
            .parse()
            .expect("host-processes.json is a valid capability");
        let CapabilityFile::Capability(capability) = file else {
            panic!("host-processes.json holds a single capability");
        };
        assert_eq!(capability.identifier, "host-processes");
        assert_eq!(capability.windows, vec!["main".to_owned()]);
    }
}
