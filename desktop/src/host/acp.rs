//! What the app checks in the ACP messages between an agent and the editor. The agent's
//! permission requests never reach the editor: calls to OpenPencil's own tools are allowed here,
//! and every other request goes to the permission window, which only the app opens. Sessions the
//! editor opens get the app's working folder, the app's own session options, and only HTTP MCP
//! servers, and a mode that never asks before running tools waits for the person to confirm it. A
//! session that opens in such a mode, as Claude Code's open in Auto, is moved to one that asks
//! before the editor hears of it.

use std::collections::{HashMap, HashSet};

use serde::Deserialize;
use serde_json::{json, Map, Value};

use super::jsonrpc::{self, Id};
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
    pub id: Id,
    pub session_id: String,
    /// The session's turn when the agent asked; a question from a turn stopped since is
    /// answered cancelled (`AcpGate::turn`).
    pub turn: u64,
    /// The request's `toolCall` and `options`, as the window shows them.
    pub params: Value,
}

/// A mode change the person confirms before the agent gets it.
#[derive(Clone, Debug, PartialEq)]
pub struct ModeChange {
    /// The editor's request, sent on once confirmed.
    pub line: String,
    /// Its JSON-RPC id, which a refusal answers.
    pub id: Option<Id>,
    pub mode: String,
    pub session_id: String,
    /// The session's turn when the editor asked; a change from a turn stopped since is refused.
    pub turn: u64,
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
    /// Send the agent a request of the app's own, holding back what the editor gets until it
    /// answers.
    Send(String),
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
    /// Tool calls the agent reported as calls to OpenPencil's tools, by session and call id:
    /// ACP makes a call's id unique within its session only.
    own_calls: HashSet<(String, String)>,
    /// Permission requests the app holds, by id, so the editor cannot answer them.
    held: HashSet<Id>,
    /// Refuses whatever the person would be asked, for a connection in which nothing may run.
    refuses_tools: bool,
    /// The editor's session openers waiting for an answer, by id, with the session they name.
    opening: HashMap<Id, Option<String>>,
    /// The app's own requests to the agent waiting for an answer, with the opener's id and the
    /// answer the editor gets once the agent took the request.
    own_requests: HashMap<Id, Option<(Id, String)>>,
    next_request: u64,
    /// How many turns of each session the editor stopped.
    turns: HashMap<String, u64>,
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
            own_requests: HashMap::new(),
            next_request: 0,
            turns: HashMap::new(),
        }
    }

    pub fn agent_wrote(&mut self, line: String) -> FromAgent {
        let Ok(Value::Object(mut message)) = serde_json::from_str::<Value>(&line) else {
            return FromAgent::Forward(line);
        };
        let id = Id::of(&message);
        let Some(method) = message.get("method").and_then(Value::as_str) else {
            return match id {
                Some(id) => self.agent_answered(id, message, line),
                None => FromAgent::Forward(line),
            };
        };
        match method {
            "session/update" => {
                let update = read::<SessionUpdate>(message.get("params"));
                let call = read::<ToolCallReport>(Some(&update.update));
                if matches!(
                    call.session_update.as_str(),
                    "tool_call" | "tool_call_update"
                ) && is_own_tool_call(&update.update)
                {
                    self.own_calls
                        .insert((update.session_id, call.tool_call_id));
                }
                FromAgent::Forward(line)
            }
            "session/request_permission" => {
                let Some(id) = id else {
                    return FromAgent::Forward(line);
                };
                let params = message.remove("params").unwrap_or(Value::Null);
                let request = read::<PermissionRequest>(Some(&params));
                if let Some(option) = self.own_call_answer(&request) {
                    return FromAgent::Answer(selected(&id, &option));
                }
                if self.refuses_tools {
                    return FromAgent::Answer(match request.reject_option() {
                        Some(option) => selected(&id, &option),
                        None => self.answer(&id, None),
                    });
                }
                self.held.insert(id.clone());
                FromAgent::Ask(PermissionAsk {
                    turn: self.turn(&request.session_id),
                    session_id: request.session_id,
                    id,
                    params,
                })
            }
            _ => FromAgent::Forward(line),
        }
    }

    /// The agent's answer to a request: the app's own, or one that opened a session, which may
    /// first need moving to a mode that asks.
    fn agent_answered(
        &mut self,
        id: Id,
        mut message: Map<String, Value>,
        line: String,
    ) -> FromAgent {
        if let Some(held) = self.own_requests.remove(&id) {
            let Some((opener, answer)) = held else {
                return FromAgent::Drop;
            };
            // The session opens only once it asks: if the agent would not switch, the editor's
            // request fails rather than show a mode the session is not in.
            return FromAgent::Forward(if message.contains_key("result") {
                answer
            } else {
                jsonrpc::failure(
                    &opener,
                    "The session could not start in a mode that asks.",
                    None,
                )
            });
        }
        let Some(named) = self.opening.remove(&id) else {
            return FromAgent::Forward(line);
        };
        let Some(Value::Object(result)) = message.get_mut("result") else {
            return FromAgent::Forward(line);
        };
        let session = result
            .get("sessionId")
            .and_then(Value::as_str)
            .map(str::to_owned)
            .or(named);
        let Some((request_id, to_agent)) =
            session.and_then(|session| self.ask_from_the_start(result, &session))
        else {
            return FromAgent::Forward(line);
        };
        let answer = Value::Object(message).to_string();
        self.own_requests.insert(request_id, Some((id, answer)));
        FromAgent::Send(to_agent)
    }

    pub fn editor_wrote(&mut self, line: String) -> FromEditor {
        let Ok(Value::Object(mut message)) = serde_json::from_str::<Value>(&line) else {
            return FromEditor::Refuse(None);
        };
        let id = Id::of(&message);
        let Some(method) = message
            .get("method")
            .and_then(Value::as_str)
            .map(str::to_owned)
        else {
            // An answer to one of the agent's requests: never to one the app holds.
            return match id {
                Some(id) if self.held.contains(&id) => FromEditor::Refuse(None),
                _ => FromEditor::Forward(line),
            };
        };
        // The agent's answer to such a request would pass for the answer to the app's own.
        if id
            .as_ref()
            .and_then(Id::as_str)
            .is_some_and(|id| id.starts_with(OWN_REQUEST_PREFIX))
        {
            return refuse(
                id,
                "Request ids starting with openpencil- are the app's own.",
            );
        }
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
                self.opening.insert(id.clone(), named);
            }
            return FromEditor::Forward(Value::Object(message).to_string());
        }
        let params = read::<SessionRequest>(message.get("params"));
        match method.as_str() {
            "session/set_mode" | "session/set_config_option" => {
                let mode = params
                    .mode_id
                    .as_deref()
                    .or(params.value.as_str())
                    .unwrap_or_default();
                if !never_asks(self.agent, mode) {
                    return FromEditor::Forward(line);
                }
                FromEditor::Confirm(ModeChange {
                    mode: mode.to_owned(),
                    turn: self.turn(&params.session_id),
                    session_id: params.session_id,
                    line,
                    id,
                })
            }
            "session/cancel" => {
                *self.turns.entry(params.session_id.clone()).or_default() += 1;
                FromEditor::Cancel {
                    session_id: params.session_id,
                    line,
                }
            }
            _ => FromEditor::Forward(line),
        }
    }

    /// How many turns of `session` the editor stopped, which tells a question asked before a
    /// Stop from one asked after it.
    pub fn turn(&self, session: &str) -> u64 {
        self.turns.get(session).copied().unwrap_or_default()
    }

    /// The answer to a held request, which the app writes to the agent.
    pub fn answer(&mut self, id: &Id, option: Option<&str>) -> String {
        self.held.remove(id);
        match option {
            Some(option) => selected(id, option),
            None => jsonrpc::success(id, json!({ "outcome": { "outcome": "cancelled" } })),
        }
    }

    /// Moves a session that opened in a mode that never asks to one that asks: the answer the
    /// editor gets shows that mode, and the request that sets it goes to the agent. None when the
    /// session already asks, or the agent offers no mode that does.
    fn ask_from_the_start(
        &mut self,
        result: &mut Map<String, Value>,
        session: &str,
    ) -> Option<(Id, String)> {
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
        let id = Id::string(format!("{OWN_REQUEST_PREFIX}{}", self.next_request));
        self.next_request += 1;
        let request = jsonrpc::request(&id, method, params);
        Some((id, request))
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

    /// The option that allows a call to OpenPencil's tools once, which leaves the agent's saved
    /// permissions alone. A request carries only the call's id, so the updates that name the
    /// call's server are noted first.
    fn own_call_answer(&self, request: &PermissionRequest) -> Option<String> {
        let call = read::<ToolCallReport>(Some(&request.tool_call));
        let key = (request.session_id.clone(), call.tool_call_id);
        if !self.own_calls.contains(&key) && !is_own_tool_call(&request.tool_call) {
            return None;
        }
        request.option(|kind| kind == "allow_once")
    }
}

/// Reads the parts of a message the gate checks. What does not read as the type reads as its
/// default, so a malformed message is held or refused, never let through unchecked.
fn read<T: for<'de> Deserialize<'de> + Default>(value: Option<&Value>) -> T {
    value
        .and_then(|value| T::deserialize(value).ok())
        .unwrap_or_default()
}

/// What `session/request_permission` carries.
#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct PermissionRequest {
    session_id: String,
    tool_call: Value,
    options: Vec<PermissionOption>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PermissionOption {
    option_id: String,
    #[serde(default)]
    kind: String,
}

impl PermissionRequest {
    fn option(&self, kind: impl Fn(&str) -> bool) -> Option<String> {
        self.options
            .iter()
            .find(|option| kind(&option.kind))
            .map(|option| option.option_id.clone())
    }

    fn reject_option(&self) -> Option<String> {
        self.option(|kind| kind.starts_with("reject"))
    }
}

/// `session/update`'s parameters.
#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct SessionUpdate {
    session_id: String,
    update: Value,
}

/// A tool call as an update or a permission request names it.
#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct ToolCallReport {
    session_update: String,
    tool_call_id: String,
}

/// The editor's requests about a session: a mode change names the mode as `modeId`, a config
/// option change as `value`.
#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct SessionRequest {
    session_id: String,
    mode_id: Option<String>,
    value: Value,
}

/// The request's first refusing option, which a question nobody answers gets.
pub fn reject_option(params: &Value) -> Option<String> {
    read::<PermissionRequest>(Some(params)).reject_option()
}

fn refuse(id: Option<Id>, reason: &str) -> FromEditor {
    FromEditor::Refuse(id.map(|id| jsonrpc::failure(&id, reason, None)))
}

/// The error a mode change gets when the person keeps the agent asking, which the chat tells
/// apart from a failure (`isModeRefusal` in `src/app/ai/agents/acp/options.ts`).
pub fn mode_refused(id: &Id) -> String {
    jsonrpc::failure(
        id,
        "The mode was not allowed.",
        Some(json!({ "openpencil": "mode-refused" })),
    )
}

fn selected(id: &Id, option: &str) -> String {
    jsonrpc::success(
        id,
        json!({ "outcome": { "outcome": "selected", "optionId": option } }),
    )
}

/// Whether a list of options holds one whose `key` is `value`, in it or in a group of it.
fn offers(options: Option<&Value>, key: &str, value: &str) -> bool {
    options.and_then(Value::as_array).is_some_and(|options| {
        options
            .iter()
            .any(|option| str_at(option, key) == value || offers(option.get("options"), key, value))
    })
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

    fn id(value: Value) -> Id {
        serde_json::from_value(value).unwrap()
    }

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
        assert_eq!(ask.id, id(json!(8)));
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
        assert_eq!(change.id, Some(id(json!(3))));
        assert_eq!((change.session_id.as_str(), change.turn), ("s1", 0));
        // A change asked after a Stop carries the turn that follows it.
        let cancel = json!({ "jsonrpc": "2.0", "method": "session/cancel", "params": { "sessionId": "s1" } });
        gate.editor_wrote(cancel.to_string());
        let FromEditor::Confirm(later) = gate.editor_wrote(set("agent-full-access")) else {
            panic!("the person confirms full access")
        };
        assert_eq!(later.turn, 1);
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
        let FromAgent::Send(to_agent) = gate.agent_wrote(opened.to_string()) else {
            panic!("the app moves the session to Manual first")
        };
        let request: Value = serde_json::from_str(&to_agent).unwrap();
        assert_eq!(request["method"], "session/set_config_option");
        assert_eq!(
            request["params"],
            json!({ "sessionId": "s9", "configId": "mode", "value": "default" })
        );
        // The editor hears of the session once the agent took the switch, in the mode it took.
        let took =
            json!({ "jsonrpc": "2.0", "id": request["id"], "result": { "configOptions": [] } });
        let FromAgent::Forward(forward) = gate.agent_wrote(took.to_string()) else {
            panic!("the opener's answer goes on")
        };
        let forward: Value = serde_json::from_str(&forward).unwrap();
        assert_eq!(forward["id"], 4);
        assert_eq!(
            forward["result"]["configOptions"][0]["currentValue"],
            "default"
        );
        assert_eq!(forward["result"]["modes"]["currentModeId"], "default");
        // An agent that will not switch fails the opener instead.
        let again = json!({ "jsonrpc": "2.0", "id": 6, "method": "session/new", "params": { "cwd": "/", "mcpServers": [] } });
        gate.editor_wrote(again.to_string());
        let mut auto = opened.clone();
        auto["id"] = json!(6);
        let FromAgent::Send(to_agent) = gate.agent_wrote(auto.to_string()) else {
            panic!("the app moves the session to Manual first")
        };
        let request: Value = serde_json::from_str(&to_agent).unwrap();
        let refused = json!({ "jsonrpc": "2.0", "id": request["id"], "error": { "code": -32602, "message": "no" } });
        let FromAgent::Forward(failed) = gate.agent_wrote(refused.to_string()) else {
            panic!("the opener fails")
        };
        let failed: Value = serde_json::from_str(&failed).unwrap();
        assert_eq!(failed["id"], 6);
        assert!(failed.get("error").is_some());
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
    fn finds_the_asking_mode_in_a_group_of_options() {
        let mut gate = gate(Agent::ClaudeCode);
        let open = json!({ "jsonrpc": "2.0", "id": 4, "method": "session/new", "params": { "cwd": "/", "mcpServers": [] } });
        gate.editor_wrote(open.to_string());
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
                    "options": [{ "group": "asks", "name": "Asks", "options": [{ "value": "default", "name": "Manual" }] }, { "value": "auto", "name": "Auto" }]
                }]
            }
        });
        let FromAgent::Send(to_agent) = gate.agent_wrote(opened.to_string()) else {
            panic!("the app moves the session to Manual first")
        };
        let request: Value = serde_json::from_str(&to_agent).unwrap();
        assert_eq!(request["params"]["value"], "default");
    }

    #[test]
    fn refuses_editor_requests_with_the_apps_own_ids() {
        let mut gate = gate(Agent::ClaudeCode);
        let spoof = json!({ "jsonrpc": "2.0", "id": "openpencil-0", "method": "session/set_mode", "params": { "sessionId": "s1", "modeId": "default" } });
        let FromEditor::Refuse(Some(answer)) = gate.editor_wrote(spoof.to_string()) else {
            panic!("the editor may not use the app's ids")
        };
        let answer: Value = serde_json::from_str(&answer).unwrap();
        assert_eq!(answer["id"], "openpencil-0");
        assert!(answer.get("error").is_some());
    }

    #[test]
    fn approves_own_calls_only_in_the_session_that_made_them() {
        let mut gate = gate(Agent::Cursor);
        let reported = update(json!({
            "sessionUpdate": "tool_call",
            "toolCallId": "c1",
            "rawInput": { "providerIdentifier": "open-pencil", "toolName": "get_selection" }
        }));
        gate.agent_wrote(reported);
        // Another session reuses the id for a call of its own.
        let mut other =
            serde_json::from_str::<Value>(&permission(10, json!({ "toolCallId": "c1" }))).unwrap();
        other["params"]["sessionId"] = json!("s2");
        assert!(matches!(
            gate.agent_wrote(other.to_string()),
            FromAgent::Ask(_)
        ));
    }

    #[test]
    fn counts_the_turns_a_stop_ends() {
        let mut gate = gate(Agent::ClaudeCode);
        let FromAgent::Ask(before) = gate.agent_wrote(permission(
            11,
            json!({ "toolCallId": "c4", "title": "Bash" }),
        )) else {
            panic!("the person decides")
        };
        let cancel = json!({ "jsonrpc": "2.0", "method": "session/cancel", "params": { "sessionId": "s1" } });
        assert!(matches!(
            gate.editor_wrote(cancel.to_string()),
            FromEditor::Cancel { .. }
        ));
        assert_ne!(gate.turn("s1"), before.turn);
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
