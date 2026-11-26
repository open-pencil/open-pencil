//! What the app checks in the requests the editor sends the harness companion: a session's MCP
//! servers are servers it reaches over HTTP, never programs it would start.

use serde_json::{json, Value};

/// The editor's line, passed on, or the harness's error answer to send back in its place.
pub fn from_editor(line: String) -> Result<String, Option<String>> {
    let Ok(message) = serde_json::from_str::<Value>(&line) else {
        return Err(None);
    };
    if message.get("method").and_then(Value::as_str) != Some("session.create") {
        return Ok(line);
    }
    let servers = message
        .get("params")
        .and_then(|params| params.get("configuration"))
        .and_then(|configuration| configuration.get("mcpServers"))
        .and_then(Value::as_object);
    let local = servers.and_then(|servers| {
        servers.iter().find(|(_, server)| {
            server.get("command").is_some() || !server.get("url").is_some_and(Value::is_string)
        })
    });
    match local {
        None => Ok(line),
        Some((name, _)) => Err(Some(
            json!({
                "type": "response",
                "id": message.get("id"),
                "error": format!("Only HTTP MCP servers can be given to the harness, not {name}.")
            })
            .to_string(),
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
    }
}
