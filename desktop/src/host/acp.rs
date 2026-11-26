//! What the app checks in the ACP messages between an agent and the editor. The agent's
//! permission requests never reach the editor: calls to OpenPencil's own tools are allowed here,
//! and every other request goes to the permission window, which only the app opens. Sessions the
//! editor opens get the app's working folder, the app's own session options, and only HTTP MCP
//! servers, and a mode that never asks before running tools waits for the person to confirm it. A
//! session that opens in such a mode, as Claude Code's open in Auto, is moved to one that asks
//! before the editor hears of it.

use std::collections::{HashMap, HashSet};

use serde_json::{json, Map, Value};

use super::program::Agent;

/// OpenPencil's MCP server name; `OPEN_PENCIL_MCP_SERVER` in `packages/core`.
const OWN_SERVER: &str = "open-pencil";

/// Methods that open a session, and so name its folder, options, and MCP servers.
const SESSION_OPENERS: &[&str] = &[
    "session/new",
    "session/load",
    "session/resume",
    "session/fork",
];

/// The modes in which an agent runs tools without asking the person, by the values its sessions
/// offer: Claude Code's `bypassPermissions`, and `auto`, where Claude's own classifier decides;
/// Codex's `agent-full-access`; and Gemini CLI's `yolo`.
fn never_asks(agent: Agent, value: &str) -> bool {
    matches!(
        (agent, value),
        (Agent::ClaudeCode, "bypassPermissions" | "auto")
            | (Agent::Codex, "agent-full-access")
            | (Agent::GeminiCli, "yolo")
    )
}

/// The mode a session that opened in one that never asks is moved to: the agent's own default
/// that asks, or Codex's sandboxed agent mode.
fn asking_mode(agent: Agent) -> Option<&'static str> {
    match agent {
        Agent::ClaudeCode | Agent::GeminiCli => Some("default"),
        Agent::Codex => Some("agent"),
        _ => None,
    }
}

/// The ids of the app's own requests to an agent, apart from any the editor uses.
const OWN_REQUEST_PREFIX: &str = "openpencil-";

/// The options every session opens with. Claude's adapter passes them to the Claude Agent SDK,
/// and other agents ignore them: OpenPencil's own tools run without asking, as their edits are
/// undoable and stay in the document, and summarized thinking shows while Claude thinks.
fn session_meta() -> Value {
    json!({
        "claudeCode": {
            "options": {
                "allowedTools": [format!("mcp__{OWN_SERVER}")],
                "thinking": { "type": "adaptive", "display": "summarized" }
            }
        }
    })
}

/// A permission request the person answers in the permission window.
#[derive(Clone, Debug, PartialEq)]
pub struct PermissionAsk {
    /// The request's JSON-RPC id, which the answer carries back to the agent.
    pub id: Value,
    pub session_id: String,
    /// The request's `toolCall` and `options`, as the window shows them.
    pub params: Value,
}

/// A mode change the person confirms before the agent gets it.
#[derive(Clone, Debug, PartialEq)]
pub struct ModeChange {
    /// The editor's request, sent on once confirmed.
    pub line: String,
    /// Its JSON-RPC id, which a refusal answers.
    pub id: Option<Value>,
    pub mode: String,
}

/// What to do with a line the agent wrote.
#[derive(Debug, PartialEq)]
pub enum FromAgent {
    /// Pass it to the editor.
    Forward(String),
    /// Answer the agent at once.
    Answer(String),
    /// Ask the person.
    Ask(PermissionAsk),
    /// Pass a changed line to the editor, and send the agent a request of the app's own.
    ForwardAndSend { forward: String, to_agent: String },
    /// An answer to the app's own request, which the editor never sent.
    Drop,
}

/// What to do with a line the editor wrote.
#[derive(Debug, PartialEq)]
pub enum FromEditor {
    /// Pass it to the agent.
    Forward(String),
    /// Answer the editor in place of the agent, or drop the line when it needs no answer.
    Refuse(Option<String>),
    /// Ask the person before passing it on.
    Confirm(ModeChange),
    /// The editor stopped a turn of this session: its open questions are answered cancelled.
    Cancel { session_id: String, line: String },
}

pub struct AcpGate {
    agent: Agent,
    workspace: String,
    /// Tool calls the agent reported as calls to OpenPencil's tools.
    own_calls: HashSet<String>,
    /// Permission requests the app holds, by id, so the editor cannot answer them.
    held: HashSet<String>,
    /// Refuses whatever the person would be asked, for a connection in which nothing may run.
    refuses_tools: bool,
    /// The editor's session openers waiting for an answer, by id, with the session they name.
    opening: HashMap<String, Option<String>>,
    /// The app's own requests to the agent waiting for an answer.
    own_requests: HashSet<String>,
    next_request: u64,
}

impl AcpGate {
    pub fn new(agent: Agent, workspace: String, refuses_tools: bool) -> Self {
        Self {
            agent,
            workspace,
            own_calls: HashSet::new(),
            held: HashSet::new(),
            refuses_tools,
            opening: HashMap::new(),
            own_requests: HashSet::new(),
            next_request: 0,
        }
    }

    pub fn agent_wrote(&mut self, line: String) -> FromAgent {
        let Ok(Value::Object(mut message)) = serde_json::from_str::<Value>(&line) else {
            return FromAgent::Forward(line);
        };
        if message.get("method").is_none() {
            let id = message.get("id").map(Value::to_string).unwrap_or_default();
            if self.own_requests.remove(&id) {
                return FromAgent::Drop;
            }
            if let Some(named) = self.opening.remove(&id) {
                if let Some(Value::Object(result)) = message.get_mut("result") {
                    let session = result
                        .get("sessionId")
                        .and_then(Value::as_str)
                        .map(str::to_owned)
                        .or(named);
                    if let Some(to_agent) =
                        session.and_then(|s| self.ask_from_the_start(result, &s))
                    {
                        return FromAgent::ForwardAndSend {
                            forward: Value::Object(message).to_string(),
                            to_agent,
                        };
                    }
                }
            }
            return FromAgent::Forward(line);
        }
        match message.get("method").and_then(Value::as_str) {
            Some("session/update") => {
                if let Some(update) = message.get("params").and_then(|p| p.get("update")) {
                    self.note_update(update);
                }
                FromAgent::Forward(line)
            }
            Some("session/request_permission") => {
                let Some(id) = message.get("id").cloned() else {
                    return FromAgent::Forward(line);
                };
                let params = message.get("params").cloned().unwrap_or(Value::Null);
                if let Some(option) = self.own_call_answer(&params) {
                    return FromAgent::Answer(selected(&id, &option));
                }
                if self.refuses_tools {
                    return FromAgent::Answer(match reject_option(&params) {
                        Some(option) => selected(&id, &option),
                        None => self.answer(&id, None),
                    });
                }
                self.held.insert(id.to_string());
                FromAgent::Ask(PermissionAsk {
                    session_id: str_at(&params, "sessionId").to_owned(),
                    id,
                    params,
                })
            }
            _ => FromAgent::Forward(line),
        }
    }

    pub fn editor_wrote(&mut self, line: String) -> FromEditor {
        let Ok(Value::Object(mut message)) = serde_json::from_str::<Value>(&line) else {
            return FromEditor::Refuse(None);
        };
        let id = message.get("id").cloned();
        let Some(method) = message
            .get("method")
            .and_then(Value::as_str)
            .map(str::to_owned)
        else {
            // An answer to one of the agent's requests: never to one the app holds.
            let held = id
                .as_ref()
                .is_some_and(|id| self.held.contains(&id.to_string()));
            return if held {
                FromEditor::Refuse(None)
            } else {
                FromEditor::Forward(line)
            };
        };
        if method == "session/options" {
            if let Some(Value::Object(params)) = message.get_mut("params") {
                params.insert("cwd".to_owned(), Value::String(self.workspace.clone()));
            }
            return FromEditor::Forward(Value::Object(message).to_string());
        }
        if SESSION_OPENERS.contains(&method.as_str()) {
            let Some(Value::Object(params)) = message.get_mut("params") else {
                return refuse(id, "A session request needs parameters.");
            };
            if let Err(reason) = self.pin_session(params) {
                return refuse(id, &reason);
            }
            let named = params
                .get("sessionId")
                .and_then(Value::as_str)
                .map(str::to_owned);
            if let Some(id) = &id {
                self.opening.insert(id.to_string(), named);
            }
            return FromEditor::Forward(Value::Object(message).to_string());
        }
        let params = message.get("params").cloned().unwrap_or(Value::Null);
        match method.as_str() {
            "session/set_mode" | "session/set_config_option" => {
                let mode = params
                    .get(if method == "session/set_mode" {
                        "modeId"
                    } else {
                        "value"
                    })
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                if never_asks(self.agent, mode) {
                    FromEditor::Confirm(ModeChange {
                        line,
                        id,
                        mode: mode.to_owned(),
                    })
                } else {
                    FromEditor::Forward(line)
                }
            }
            "session/cancel" => FromEditor::Cancel {
                session_id: str_at(&params, "sessionId").to_owned(),
                line,
            },
            _ => FromEditor::Forward(line),
        }
    }

    /// The answer to a held request, which the app writes to the agent.
    pub fn answer(&mut self, id: &Value, option: Option<&str>) -> String {
        self.held.remove(&id.to_string());
        match option {
            Some(option) => selected(id, option),
            None => json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": { "outcome": { "outcome": "cancelled" } }
            })
            .to_string(),
        }
    }

    /// Moves a session that opened in a mode that never asks to one that asks: the answer the
    /// editor gets shows that mode, and the request that sets it goes to the agent. None when the
    /// session already asks, or the agent offers no mode that does.
    fn ask_from_the_start(
        &mut self,
        result: &mut Map<String, Value>,
        session: &str,
    ) -> Option<String> {
        let safe = asking_mode(self.agent)?;
        let agent = self.agent;
        let mut request = None;
        if let Some(Value::Array(options)) = result.get_mut("configOptions") {
            let mode = options.iter_mut().find(|option| {
                str_at(option, "category") == "mode"
                    && never_asks(agent, str_at(option, "currentValue"))
                    && offers(option.get("options"), "value", safe)
            });
            if let Some(mode) = mode {
                mode["currentValue"] = Value::String(safe.to_owned());
                request = Some((
                    "session/set_config_option",
                    json!({
                        "sessionId": session,
                        "configId": str_at(mode, "id"),
                        "value": safe
                    }),
                ));
            }
        }
        if let Some(modes) = result.get_mut("modes") {
            if never_asks(agent, str_at(modes, "currentModeId"))
                && offers(modes.get("availableModes"), "id", safe)
            {
                modes["currentModeId"] = Value::String(safe.to_owned());
                request.get_or_insert((
                    "session/set_mode",
                    json!({ "sessionId": session, "modeId": safe }),
                ));
            }
        }
        let (method, params) = request?;
        let id = format!("{OWN_REQUEST_PREFIX}{}", self.next_request);
        self.next_request += 1;
        self.own_requests
            .insert(Value::String(id.clone()).to_string());
        Some(json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params }).to_string())
    }

    fn pin_session(&self, params: &mut Map<String, Value>) -> Result<(), String> {
        if let Some(Value::Array(servers)) = params.get("mcpServers") {
            // A server with a command is one the agent would start.
            let local = servers.iter().find(|server| {
                !matches!(
                    server.get("type").and_then(Value::as_str),
                    Some("http" | "sse")
                )
            });
            if let Some(server) = local {
                return Err(format!(
                    "Only HTTP MCP servers can be given to an agent, not {}.",
                    str_at(server, "name")
                ));
            }
        }
        params.insert("cwd".to_owned(), Value::String(self.workspace.clone()));
        params.insert("_meta".to_owned(), session_meta());
        Ok(())
    }

    fn note_update(&mut self, update: &Value) {
        let kind = str_at(update, "sessionUpdate");
        if kind != "tool_call" && kind != "tool_call_update" {
            return;
        }
        if is_own_tool_call(update) {
            self.own_calls
                .insert(str_at(update, "toolCallId").to_owned());
        }
    }

    /// The option that allows a call to OpenPencil's tools once, which leaves the agent's saved
    /// permissions alone. A request carries only the call's id, so the updates that name the
    /// call's server are noted first.
    fn own_call_answer(&self, params: &Value) -> Option<String> {
        let call = params.get("toolCall")?;
        let id = str_at(call, "toolCallId");
        if !self.own_calls.contains(id) && !is_own_tool_call(call) {
            return None;
        }
        params
            .get("options")?
            .as_array()?
            .iter()
            .find(|option| str_at(option, "kind") == "allow_once")
            .map(|option| str_at(option, "optionId").to_owned())
    }
}

/// The request's first refusing option, which a question nobody answers gets.
pub fn reject_option(params: &Value) -> Option<String> {
    params
        .get("options")?
        .as_array()?
        .iter()
        .find(|option| str_at(option, "kind").starts_with("reject"))
        .map(|option| str_at(option, "optionId").to_owned())
}

fn refuse(id: Option<Value>, reason: &str) -> FromEditor {
    FromEditor::Refuse(id.map(|id| error_response(&id, reason)))
}

/// The error a mode change gets when the person keeps the agent asking, which the chat tells
/// apart from a failure (`isModeRefusal` in `src/app/ai/agents/acp/options.ts`).
pub fn mode_refused(id: &Value) -> String {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "error": {
            "code": -32602,
            "message": "The mode was not allowed.",
            "data": { "openpencil": "mode-refused" }
        }
    })
    .to_string()
}

/// A JSON-RPC error answering the editor's request `id`.
pub fn error_response(id: &Value, reason: &str) -> String {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "error": { "code": -32602, "message": reason }
    })
    .to_string()
}

fn selected(id: &Value, option: &str) -> String {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "result": { "outcome": { "outcome": "selected", "optionId": option } }
    })
    .to_string()
}

/// Whether a list of options holds one whose `key` is `value`.
fn offers(options: Option<&Value>, key: &str, value: &str) -> bool {
    options
        .and_then(Value::as_array)
        .is_some_and(|options| options.iter().any(|option| str_at(option, key) == value))
}

fn str_at<'a>(value: &'a Value, key: &str) -> &'a str {
    value.get(key).and_then(Value::as_str).unwrap_or_default()
}

/// Whether a tool call goes to OpenPencil's own MCP server, by the way each agent names one;
/// `isOwnToolCall` in `src/app/ai/agents/acp/events.ts` reads the same reports for the chat.
fn is_own_tool_call(call: &Value) -> bool {
    let input = call.get("rawInput").unwrap_or(&Value::Null);
    let title = str_at(call, "title");
    // Codex: `mcp.<server>.<tool>`, with the server and tool as the input.
    if str_at(input, "server") == OWN_SERVER
        && title == format!("mcp.{OWN_SERVER}.{}", str_at(input, "tool"))
    {
        return true;
    }
    // Claude Code names the SDK tool in its metadata.
    let claude_tool = call
        .get("_meta")
        .and_then(|meta| meta.get("claudeCode"))
        .map(|claude| str_at(claude, "toolName"));
    if let Some(tool) = claude_tool {
        return tool.starts_with(&format!("mcp__{OWN_SERVER}__"));
    }
    // Cursor names the server in its input.
    if str_at(input, "providerIdentifier") == OWN_SERVER && input.get("toolName").is_some() {
        return true;
    }
    // Grok Build calls every MCP tool through `use_tool`, naming it `server__tool`.
    let grok = call
        .get("_meta")
        .and_then(|meta| meta.get("x.ai/tool"))
        .is_some_and(|tool| str_at(tool, "name") == "use_tool");
    if grok {
        return str_at(input, "tool_name").starts_with(&format!("{OWN_SERVER}__"));
    }
    // Antigravity CLI titles a call `Run mcp_<server>_<tool>`.
    title.starts_with(&format!("Run mcp_{OWN_SERVER}_"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn gate(agent: Agent) -> AcpGate {
        AcpGate::new(agent, "/data/agent-workspace".to_owned(), false)
    }

    fn permission(id: u64, call: Value) -> String {
        json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": "session/request_permission",
            "params": {
                "sessionId": "s1",
                "toolCall": call,
                "options": [
                    { "optionId": "always", "name": "Always", "kind": "allow_always" },
                    { "optionId": "once", "name": "Allow", "kind": "allow_once" },
                    { "optionId": "no", "name": "Reject", "kind": "reject_once" }
                ]
            }
        })
        .to_string()
    }

    fn update(call: Value) -> String {
        json!({
            "jsonrpc": "2.0",
            "method": "session/update",
            "params": { "sessionId": "s1", "update": call }
        })
        .to_string()
    }

    #[test]
    fn allows_calls_to_openpencil_tools_once_without_asking() {
        let mut gate = gate(Agent::Cursor);
        let reported = update(json!({
            "sessionUpdate": "tool_call",
            "toolCallId": "c1",
            "rawInput": { "providerIdentifier": "open-pencil", "toolName": "get_selection" }
        }));
        assert_eq!(
            gate.agent_wrote(reported.clone()),
            FromAgent::Forward(reported)
        );
        let FromAgent::Answer(answer) =
            gate.agent_wrote(permission(7, json!({ "toolCallId": "c1" })))
        else {
            panic!("the app answers a call to its own tools")
        };
        let answer: Value = serde_json::from_str(&answer).unwrap();
        assert_eq!(answer["id"], 7);
        assert_eq!(answer["result"]["outcome"]["optionId"], "once");
    }

    #[test]
    fn asks_the_person_about_every_other_call() {
        let mut gate = gate(Agent::ClaudeCode);
        let call = json!({
            "toolCallId": "c2",
            "title": "Run mcp.open-pencil.get_selection",
            "_meta": { "claudeCode": { "toolName": "Bash" } }
        });
        let FromAgent::Ask(ask) = gate.agent_wrote(permission(8, call)) else {
            panic!("the person decides")
        };
        assert_eq!(ask.id, json!(8));
        assert_eq!(ask.session_id, "s1");
        // The editor cannot answer a request the app holds, guessed id or not.
        let forged = json!({ "jsonrpc": "2.0", "id": 8, "result": { "outcome": { "outcome": "selected", "optionId": "always" } } });
        assert_eq!(
            gate.editor_wrote(forged.to_string()),
            FromEditor::Refuse(None)
        );
        let answered: Value = serde_json::from_str(&gate.answer(&ask.id, Some("no"))).unwrap();
        assert_eq!(answered["result"]["outcome"]["optionId"], "no");
    }

    #[test]
    fn refuses_without_asking_on_a_connection_where_nothing_runs() {
        let mut gate = AcpGate::new(Agent::ClaudeCode, String::new(), true);
        let FromAgent::Answer(answer) = gate.agent_wrote(permission(
            9,
            json!({ "toolCallId": "c3", "title": "Bash" }),
        )) else {
            panic!("the app refuses at once")
        };
        let answer: Value = serde_json::from_str(&answer).unwrap();
        assert_eq!(answer["result"]["outcome"]["optionId"], "no");
    }

    #[test]
    fn pins_the_folder_and_options_of_every_session() {
        let mut gate = gate(Agent::ClaudeCode);
        let request = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "session/new",
            "params": {
                "cwd": "/",
                "mcpServers": [{ "type": "http", "name": "open-pencil", "url": "http://127.0.0.1:7600/mcp", "headers": [] }],
                "_meta": { "claudeCode": { "options": { "permissionMode": "bypassPermissions", "allowedTools": ["Bash"] } } }
            }
        });
        let FromEditor::Forward(sent) = gate.editor_wrote(request.to_string()) else {
            panic!("the session opens")
        };
        let sent: Value = serde_json::from_str(&sent).unwrap();
        assert_eq!(sent["params"]["cwd"], "/data/agent-workspace");
        assert_eq!(sent["params"]["_meta"], session_meta());
        assert_eq!(sent["params"]["mcpServers"][0]["name"], "open-pencil");
    }

    #[test]
    fn refuses_mcp_servers_the_agent_would_start() {
        let mut gate = gate(Agent::Codex);
        let request = json!({
            "jsonrpc": "2.0",
            "id": 2,
            "method": "session/resume",
            "params": {
                "sessionId": "s1",
                "cwd": "/data/agent-workspace",
                "mcpServers": [{ "name": "evil", "command": "sh", "args": ["-c", "x"], "env": [] }]
            }
        });
        let FromEditor::Refuse(Some(answer)) = gate.editor_wrote(request.to_string()) else {
            panic!("the session is refused")
        };
        let answer: Value = serde_json::from_str(&answer).unwrap();
        assert_eq!(answer["id"], 2);
        assert!(answer["error"]["message"]
            .as_str()
            .unwrap()
            .contains("evil"));
    }

    #[test]
    fn confirms_a_mode_that_never_asks() {
        let mut gate = gate(Agent::Codex);
        let set = |value: &str| {
            json!({
                "jsonrpc": "2.0",
                "id": 3,
                "method": "session/set_config_option",
                "params": { "sessionId": "s1", "configId": "mode", "value": value }
            })
            .to_string()
        };
        assert_eq!(
            gate.editor_wrote(set("read-only")),
            FromEditor::Forward(set("read-only"))
        );
        let FromEditor::Confirm(change) = gate.editor_wrote(set("agent-full-access")) else {
            panic!("the person confirms full access")
        };
        assert_eq!(change.mode, "agent-full-access");
        assert_eq!(change.id, Some(json!(3)));
        // The same name means nothing to another agent.
        assert!(matches!(
            AcpGate::new(Agent::Cursor, String::new(), false)
                .editor_wrote(set("agent-full-access")),
            FromEditor::Forward(_)
        ));
    }

    #[test]
    fn moves_a_session_that_opens_in_auto_to_asking() {
        let mut gate = gate(Agent::ClaudeCode);
        let open = json!({ "jsonrpc": "2.0", "id": 4, "method": "session/new", "params": { "cwd": "/", "mcpServers": [] } });
        assert!(matches!(
            gate.editor_wrote(open.to_string()),
            FromEditor::Forward(_)
        ));
        let opened = json!({
            "jsonrpc": "2.0",
            "id": 4,
            "result": {
                "sessionId": "s9",
                "configOptions": [{
                    "id": "mode",
                    "category": "mode",
                    "type": "select",
                    "currentValue": "auto",
                    "options": [{ "value": "default", "name": "Manual" }, { "value": "auto", "name": "Auto" }]
                }],
                "modes": { "currentModeId": "auto", "availableModes": [{ "id": "default" }, { "id": "auto" }] }
            }
        });
        let FromAgent::ForwardAndSend { forward, to_agent } = gate.agent_wrote(opened.to_string())
        else {
            panic!("the app moves the session to Manual")
        };
        let forward: Value = serde_json::from_str(&forward).unwrap();
        assert_eq!(
            forward["result"]["configOptions"][0]["currentValue"],
            "default"
        );
        assert_eq!(forward["result"]["modes"]["currentModeId"], "default");
        let request: Value = serde_json::from_str(&to_agent).unwrap();
        assert_eq!(request["method"], "session/set_config_option");
        assert_eq!(
            request["params"],
            json!({ "sessionId": "s9", "configId": "mode", "value": "default" })
        );
        // Its answer is the app's, not the editor's.
        let answer =
            json!({ "jsonrpc": "2.0", "id": request["id"], "result": { "configOptions": [] } });
        assert_eq!(gate.agent_wrote(answer.to_string()), FromAgent::Drop);
        // A session that already asks is passed on as it is.
        let again = json!({ "jsonrpc": "2.0", "id": 5, "method": "session/new", "params": { "cwd": "/", "mcpServers": [] } });
        gate.editor_wrote(again.to_string());
        let asking = json!({ "jsonrpc": "2.0", "id": 5, "result": { "sessionId": "s10", "modes": { "currentModeId": "default", "availableModes": [] } } });
        assert_eq!(
            gate.agent_wrote(asking.to_string()),
            FromAgent::Forward(asking.to_string())
        );
    }

    #[test]
    fn tells_openpencil_tool_calls_from_the_rest() {
        let own = [
            json!({ "title": "mcp.open-pencil.render", "rawInput": { "server": "open-pencil", "tool": "render" } }),
            json!({ "_meta": { "claudeCode": { "toolName": "mcp__open-pencil__render" } } }),
            json!({ "rawInput": { "providerIdentifier": "open-pencil", "toolName": "render" } }),
            json!({ "_meta": { "x.ai/tool": { "name": "use_tool" } }, "rawInput": { "tool_name": "open-pencil__render" } }),
            json!({ "title": "Run mcp_open-pencil_render" }),
        ];
        for call in own {
            assert!(is_own_tool_call(&call), "{call}");
        }
        let other = [
            json!({ "title": "mcp.other.render", "rawInput": { "server": "other", "tool": "render" } }),
            json!({ "title": "Run mcp_open-pencil_x", "_meta": { "claudeCode": { "toolName": "Bash" } } }),
            json!({ "_meta": { "x.ai/tool": { "name": "use_tool" } }, "rawInput": { "tool_name": "other__render" } }),
            json!({ "title": "Bash" }),
        ];
        for call in other {
            assert!(!is_own_tool_call(&call), "{call}");
        }
    }
}
