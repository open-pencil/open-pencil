//! What the app checks in the requests the editor sends the harness companion: a session's MCP
//! servers are servers it reaches over HTTP, never programs it would start.

use std::collections::BTreeMap;

use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
struct Message {
    #[serde(default)]
    id: Value,
    #[serde(default)]
    method: Option<String>,
    #[serde(default)]
    params: Value,
}

#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct CreateParams {
    configuration: Configuration,
}

#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct Configuration {
    mcp_servers: BTreeMap<String, McpServer>,
}

#[derive(Deserialize)]
struct McpServer {
    #[serde(default)]
    command: Option<Value>,
    #[serde(default)]
    url: Option<String>,
}

impl McpServer {
    /// Whether the harness reaches the server over HTTP rather than starting it.
    fn is_remote(&self) -> bool {
        self.command.is_none()
            && self
                .url
                .as_deref()
                .is_some_and(|url| url.starts_with("http://") || url.starts_with("https://"))
    }
}

/// The editor's line, passed on, or the harness's error answer to send back in its place.
pub fn from_editor(line: String) -> Result<String, Option<String>> {
    let Ok(message) = serde_json::from_str::<Message>(&line) else {
        return Err(None);
    };
    if message.method.as_deref() != Some("session.create") {
        return Ok(line);
    }
    let refuse = |error: String| {
        Err(Some(
            json!({ "type": "response", "id": message.id, "error": error }).to_string(),
        ))
    };
    // Servers that do not read as the harness takes them are refused, not passed on unchecked.
    let Ok(params) = CreateParams::deserialize(&message.params) else {
        return refuse("The session's MCP servers could not be read.".to_owned());
    };
    match params
        .configuration
        .mcp_servers
        .iter()
        .find(|(_, server)| !server.is_remote())
    {
        None => Ok(line),
        Some((name, _)) => refuse(format!(
            "Only HTTP MCP servers can be given to the harness, not {name}."
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create(servers: Value) -> String {
        json!({
            "id": "r1",
            "method": "session.create",
            "params": { "sessionId": "s1", "configuration": { "adapter": "pi", "sandbox": "just-bash", "mcpServers": servers } }
        })
        .to_string()
    }

    #[test]
    fn passes_http_servers_and_other_requests() {
        let line =
            create(json!({ "open-pencil": { "url": "http://127.0.0.1:7600/mcp", "headers": {} } }));
        assert_eq!(from_editor(line.clone()), Ok(line));
        let turn = json!({ "id": "r2", "method": "session.turn", "params": { "sessionId": "s1", "prompt": "hi" } }).to_string();
        assert_eq!(from_editor(turn.clone()), Ok(turn));
    }

    #[test]
    fn refuses_a_server_the_harness_would_start() {
        let Err(Some(answer)) = from_editor(create(
            json!({ "evil": { "command": "sh", "args": ["-c", "x"] } }),
        )) else {
            panic!("the session is refused")
        };
        let answer: Value = serde_json::from_str(&answer).unwrap();
        assert_eq!(answer["id"], "r1");
        assert!(answer["error"].as_str().unwrap().contains("evil"));
        assert_eq!(from_editor("not json".to_owned()), Err(None));
        // Only a server reached over HTTP: another scheme is refused, HTTPS passes.
        assert!(from_editor(create(json!({ "files": { "url": "ftp://host/mcp" } }))).is_err());
        let https = create(json!({ "remote": { "url": "https://mcp.example.com/mcp" } }));
        assert_eq!(from_editor(https.clone()), Ok(https));
        // Servers in a shape the harness does not take are refused too.
        assert!(from_editor(create(json!([{ "command": "sh" }]))).is_err());
    }
}
