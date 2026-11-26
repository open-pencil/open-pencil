//! The programs the editor may ask the app to start, and how each one starts. The editor names a
//! program and a few typed values; the executable, its arguments, its folder, and its environment
//! come from here, so a page in the editor cannot start anything else or change how these start.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use serde::Deserialize;

/// The ACP agents OpenPencil starts, as `ACP_AGENTS` in `packages/core/src/ai/providers.ts` names
/// them.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Agent {
    ClaudeCode,
    Codex,
    GeminiCli,
    Antigravity,
    Cursor,
    GrokBuild,
}

impl Agent {
    pub fn name(self) -> &'static str {
        match self {
            Agent::ClaudeCode => "Claude Code",
            Agent::Codex => "Codex",
            Agent::GeminiCli => "Gemini CLI",
            Agent::Antigravity => "Antigravity",
            Agent::Cursor => "Cursor",
            Agent::GrokBuild => "Grok Build",
        }
    }

    fn command(self) -> (&'static str, &'static [&'static str]) {
        match self {
            Agent::ClaudeCode => ("claude-agent-acp", &[]),
            Agent::Codex => ("codex-acp", &[]),
            Agent::GeminiCli => ("gemini", &["--acp"]),
            Agent::Antigravity => ("agy", &["acp", "--process-per-session"]),
            Agent::Cursor => ("cursor-agent", &["acp"]),
            Agent::GrokBuild => ("grok", &["agent", "stdio"]),
        }
    }

    /// The login an agent signs in with outside ACP, for the agents that have one.
    fn sign_in(self) -> Option<(&'static str, &'static [&'static str])> {
        match self {
            Agent::ClaudeCode => Some((
                "claude-agent-acp",
                &["--cli", "auth", "login", "--claudeai"],
            )),
            _ => None,
        }
    }

    /// The npm package that adds ACP to an agent that lacks it.
    fn adapter_package(self) -> Option<&'static str> {
        match self {
            Agent::ClaudeCode => Some("@agentclientprotocol/claude-agent-acp"),
            Agent::Codex => Some("@agentclientprotocol/codex-acp"),
            _ => None,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PackageManager {
    Npm,
    Bun,
}

/// What an install puts in place: an agent's ACP adapter, or one of OpenPencil's companions at
/// the version the editor runs.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Package {
    Adapter { agent: Agent },
    Mcp { version: String },
    Harness { version: String },
}

/// The MCP server's tool scope, as `OPENPENCIL_MCP_SCOPE` reads it.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum McpScope {
    Document,
    Selection,
}

/// A program the editor asks for, with the values it may choose.
#[derive(Clone, Debug, PartialEq, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum ProgramRequest {
    /// An ACP agent, talking ACP over its standard streams. One that `refuses_tools` has every
    /// permission request refused without asking, for a connection in which nothing may run;
    /// the editor can ask for less this way, never more.
    Agent {
        agent: Agent,
        #[serde(default)]
        refuses_tools: bool,
    },
    /// An agent's own login, which prints a page to open and reads a pasted code.
    SignIn { agent: Agent },
    Install {
        manager: PackageManager,
        package: Package,
    },
    /// OpenPencil's MCP server on its fixed port, with tokens the app makes (`super::mcp`).
    McpServer {
        /// MCP clients may connect without a token, with the client token's reach.
        tokenless_clients: bool,
        /// The folder its file tools work in.
        root: PathBuf,
        disabled_tools: Vec<String>,
        scope: McpScope,
    },
    /// The Pi harness companion, signed in with an API key or Pi's own folder.
    Harness {
        api_key: Option<String>,
        agent_dir: Option<PathBuf>,
    },
}

/// How a program's streams are read: whether the app checks what passes between it and the
/// editor.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Protocol {
    /// ACP, whose permission requests and session settings the app handles; the flag refuses
    /// every request the person would be asked.
    Acp(Agent, bool),
    /// The harness's JSON lines, whose session settings the app checks.
    Harness,
    /// The MCP server, which asks the app before a tool reads or writes a file it was given.
    Mcp,
    /// Output passed to the editor as it is.
    Plain,
}

/// A program resolved to what starts it.
#[derive(Debug, PartialEq, Eq)]
pub struct Launch {
    pub program: &'static str,
    pub args: Vec<String>,
    pub env: BTreeMap<&'static str, String>,
    /// Where it runs; `None` keeps the app's own folder.
    pub cwd: Option<PathBuf>,
    pub protocol: Protocol,
}

/// What a launch needs from the app that started it.
pub struct LaunchContext<'a> {
    /// The folder agents run in (`agent_workspace`).
    pub workspace: &'a Path,
    /// The editor's origin, which the MCP server lets call it.
    pub origin: &'a str,
}

/// OpenPencil's MCP server listens here; `AUTOMATION_HTTP_PORT` in `packages/core`.
const MCP_PORT: u16 = 7600;
/// How long a started MCP server waits for the app before it exits; see `spawn.ts`.
const MCP_APP_TIMEOUT_MS: u32 = 30_000;

const PUBLIC_REGISTRY: &str = "--registry=https://registry.npmjs.org";

impl ProgramRequest {
    pub fn launch(&self, context: &LaunchContext) -> Result<Launch, String> {
        match self {
            ProgramRequest::Agent {
                agent,
                refuses_tools,
            } => {
                let (program, args) = agent.command();
                Ok(Launch {
                    program,
                    args: strings(args),
                    env: BTreeMap::new(),
                    // Antigravity adds its process folder to the session's workspace.
                    cwd: Some(context.workspace.to_path_buf()),
                    protocol: Protocol::Acp(*agent, *refuses_tools),
                })
            }
            ProgramRequest::SignIn { agent } => {
                let (program, args) = agent
                    .sign_in()
                    .ok_or_else(|| format!("{} signs in through ACP.", agent.name()))?;
                Ok(plain(program, strings(args)))
            }
            ProgramRequest::Install { manager, package } => {
                let name = package_name(package)?;
                let args = match manager {
                    PackageManager::Npm => vec!["install", "--global", &name, PUBLIC_REGISTRY],
                    PackageManager::Bun => {
                        if matches!(package, Package::Adapter { .. }) {
                            return Err("Agent adapters install with npm.".to_owned());
                        }
                        vec!["add", "--global", &name, PUBLIC_REGISTRY]
                    }
                };
                let program = match manager {
                    PackageManager::Npm => "npm",
                    PackageManager::Bun => "bun",
                };
                Ok(plain(program, args.into_iter().map(str::to_owned).collect()))
            }
            ProgramRequest::McpServer {
                tokenless_clients,
                root,
                disabled_tools,
                scope,
            } => {
                if !root.is_absolute() || !root.is_dir() {
                    return Err("The MCP folder must be a folder that exists.".to_owned());
                }
                if let Some(tool) = disabled_tools.iter().find(|tool| !is_tool_name(tool)) {
                    return Err(format!("{tool:?} is not a tool name."));
                }
                let mut env = BTreeMap::from([
                    ("PORT", MCP_PORT.to_string()),
                    // The server asks over its standard streams before a tool reads or writes
                    // a file it was given; only the app holds those streams.
                    ("OPENPENCIL_MCP_CONSENT", "stdio".to_owned()),
                    ("OPENPENCIL_MCP_CORS_ORIGIN", context.origin.to_owned()),
                    ("OPENPENCIL_MCP_TCP", "1".to_owned()),
                    ("OPENPENCIL_MCP_ROOT", root.to_string_lossy().into_owned()),
                    ("OPENPENCIL_MCP_APP_TIMEOUT_MS", MCP_APP_TIMEOUT_MS.to_string()),
                    // Killing a Windows shim leaves the server it started; it exits when its
                    // standard input closes with the app's end of the pipe.
                    ("OPENPENCIL_MCP_EXIT_ON_STDIN_CLOSE", "1".to_owned()),
                    ("OPENPENCIL_MCP_DISABLED_TOOLS", disabled_tools.join(",")),
                ]);
                if *tokenless_clients {
                    env.insert("OPENPENCIL_MCP_TOKENLESS_CLIENTS", "1".to_owned());
                }
                env.insert(
                    "OPENPENCIL_MCP_SCOPE",
                    match scope {
                        McpScope::Document => "document",
                        McpScope::Selection => "selection",
                    }
                    .to_owned(),
                );
                Ok(Launch {
                    env,
                    protocol: Protocol::Mcp,
                    ..plain("openpencil-mcp-http", Vec::new())
                })
            }
            ProgramRequest::Harness { api_key, agent_dir } => {
                let env = match (api_key, agent_dir) {
                    (Some(key), None) => BTreeMap::from([("OPENPENCIL_HARNESS_API_KEY", key.clone())]),
                    (None, Some(dir)) if dir.is_absolute() => BTreeMap::from([(
                        "OPENPENCIL_HARNESS_AGENT_DIR",
                        dir.to_string_lossy().into_owned(),
                    )]),
                    (None, None) => BTreeMap::new(),
                    _ => {
                        return Err(
                            "The harness signs in with an API key or an absolute Pi folder."
                                .to_owned(),
                        )
                    }
                };
                Ok(Launch {
                    env,
                    protocol: Protocol::Harness,
                    ..plain("openpencil-harness", Vec::new())
                })
            }
        }
    }
}

fn plain(program: &'static str, args: Vec<String>) -> Launch {
    Launch {
        program,
        args,
        env: BTreeMap::new(),
        cwd: None,
        protocol: Protocol::Plain,
    }
}

fn strings(args: &[&str]) -> Vec<String> {
    args.iter().map(|arg| (*arg).to_owned()).collect()
}

fn package_name(package: &Package) -> Result<String, String> {
    match package {
        Package::Adapter { agent } => agent
            .adapter_package()
            .map(str::to_owned)
            .ok_or_else(|| format!("{} needs no adapter.", agent.name())),
        Package::Mcp { version } => companion("@open-pencil/mcp", version),
        Package::Harness { version } => companion("@open-pencil/harness", version),
    }
}

/// A companion pinned to a release version, `1.2.3` or `1.2.3-beta.4`, so the install cannot
/// name a tag, a range, a path, or another registry.
fn companion(name: &str, version: &str) -> Result<String, String> {
    let parsed = semver::Version::parse(version).map_err(|_| format!("{version:?} is not a version."))?;
    let release = parsed.build.is_empty()
        && (parsed.pre.is_empty()
            || parsed
                .pre
                .as_str()
                .strip_prefix("beta.")
                .is_some_and(|n| n.parse::<u32>().is_ok_and(|n| n > 0) && !n.starts_with('0')));
    if !release {
        return Err(format!("{version:?} is not a release version."));
    }
    Ok(format!("{name}@{version}"))
}

fn is_tool_name(name: &str) -> bool {
    !name.is_empty()
        && name
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}

#[cfg(test)]
mod tests {
    use super::*;

    fn context(workspace: &Path) -> LaunchContext<'_> {
        LaunchContext {
            workspace,
            origin: "tauri://localhost",
        }
    }

    fn request(json: serde_json::Value) -> ProgramRequest {
        serde_json::from_value(json).expect("a program request")
    }

    #[test]
    fn starts_agents_in_the_workspace_with_their_fixed_arguments() {
        let workspace = Path::new("/data/agent-workspace");
        let launch = request(serde_json::json!({ "kind": "agent", "agent": "antigravity" }))
            .launch(&context(workspace))
            .unwrap();
        assert_eq!(launch.program, "agy");
        assert_eq!(launch.args, ["acp", "--process-per-session"]);
        assert_eq!(launch.cwd.as_deref(), Some(workspace));
        assert!(launch.env.is_empty());
        assert_eq!(launch.protocol, Protocol::Acp(Agent::Antigravity, false));
    }

    #[test]
    fn takes_no_command_arguments_or_environment_from_the_editor() {
        for extra in [
            serde_json::json!({ "kind": "agent", "agent": "codex", "args": ["-c", "x"] }),
            serde_json::json!({ "kind": "agent", "agent": "codex", "env": { "NODE_OPTIONS": "-r x" } }),
        ] {
            let launch = request(extra).launch(&context(Path::new("/w"))).unwrap();
            assert!(launch.args.is_empty());
            assert!(launch.env.is_empty());
        }
        assert!(serde_json::from_value::<ProgramRequest>(
            serde_json::json!({ "kind": "agent", "agent": "sh" })
        )
        .is_err());
    }

    #[test]
    fn signs_in_only_agents_with_a_login() {
        let launch = request(serde_json::json!({ "kind": "signIn", "agent": "claude-code" }))
            .launch(&context(Path::new("/w")))
            .unwrap();
        assert_eq!(launch.args, ["--cli", "auth", "login", "--claudeai"]);
        assert!(request(serde_json::json!({ "kind": "signIn", "agent": "codex" }))
            .launch(&context(Path::new("/w")))
            .is_err());
    }

    #[test]
    fn installs_only_adapters_and_released_companions() {
        let install = |package: serde_json::Value, manager: &str| {
            request(serde_json::json!({ "kind": "install", "manager": manager, "package": package }))
                .launch(&context(Path::new("/w")))
        };
        assert_eq!(
            install(serde_json::json!({ "kind": "adapter", "agent": "codex" }), "npm")
                .unwrap()
                .args,
            ["install", "--global", "@agentclientprotocol/codex-acp", PUBLIC_REGISTRY]
        );
        assert_eq!(
            install(serde_json::json!({ "kind": "mcp", "version": "0.16.0-beta.2" }), "bun")
                .unwrap()
                .args,
            ["add", "--global", "@open-pencil/mcp@0.16.0-beta.2", PUBLIC_REGISTRY]
        );
        for version in ["latest", "^1.0.0", "1.0.0-beta.0", "1.0.0-rc.1", "file:../x", "1.0.0+x"] {
            assert!(
                install(serde_json::json!({ "kind": "harness", "version": version }), "npm").is_err(),
                "{version}"
            );
        }
        assert!(install(serde_json::json!({ "kind": "adapter", "agent": "gemini-cli" }), "npm").is_err());
    }

    #[test]
    fn checks_what_the_mcp_server_is_given() {
        let root = std::env::temp_dir();
        let server = |tokenless: bool, tools: &[&str]| {
            request(serde_json::json!({
                "kind": "mcpServer",
                "tokenlessClients": tokenless,
                "root": root,
                "disabledTools": tools,
                "scope": "selection"
            }))
            .launch(&context(Path::new("/w")))
        };
        let launch = server(false, &["eval", "export_image"]).unwrap();
        assert_eq!(launch.env["PORT"], "7600");
        assert_eq!(launch.env["OPENPENCIL_MCP_CORS_ORIGIN"], "tauri://localhost");
        assert_eq!(launch.env["OPENPENCIL_MCP_DISABLED_TOOLS"], "eval,export_image");
        assert_eq!(launch.env["OPENPENCIL_MCP_SCOPE"], "selection");
        assert_eq!(launch.env["OPENPENCIL_MCP_CONSENT"], "stdio");
        assert!(!launch.env.contains_key("OPENPENCIL_MCP_TOKENLESS_CLIENTS"));
        assert_eq!(server(true, &[]).unwrap().env["OPENPENCIL_MCP_TOKENLESS_CLIENTS"], "1");
        assert!(server(false, &["a,b"]).is_err());
    }

    #[test]
    fn signs_the_harness_in_one_way() {
        let harness = |value: serde_json::Value| {
            let mut json = serde_json::json!({ "kind": "harness" });
            json.as_object_mut().unwrap().extend(value.as_object().unwrap().clone());
            request(json).launch(&context(Path::new("/w")))
        };
        assert_eq!(
            harness(serde_json::json!({ "apiKey": "k" })).unwrap().env["OPENPENCIL_HARNESS_API_KEY"],
            "k"
        );
        assert!(harness(serde_json::json!({ "agentDir": "relative" })).is_err());
        assert!(harness(serde_json::json!({ "apiKey": "k", "agentDir": "/p" })).is_err());
    }
}
