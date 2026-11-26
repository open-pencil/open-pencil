//! OpenPencil's MCP server as the app runs it. The app makes its tokens: the server's own, which
//! opens everything and stays with the app and the discovery file that other programs read; the
//! client token for agents and MCP clients; and an app token that only registers the editor. The
//! editor gets the last two. The server asks the app over its standard streams before a tool
//! reads or writes a file it was given, and the app asks the person.

use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;

/// Names what the client token is derived for; `CLIENT_TOKEN_CONTEXT` in
/// `packages/mcp/src/tool/client-token.ts`, which external clients' tokens follow too.
const CLIENT_TOKEN_CONTEXT: &[u8] = b"openpencil-mcp-client-token-v1";

/// The tools whose files the editor itself opens or saves, so allowing one lets the editor reach
/// that file. Other tools' files the server reads and writes itself.
const EDITOR_FILE_TOOLS: &[&str] = &[
    "open_document",
    "save_document",
    "create_document",
    "close_document",
];

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct McpTokens {
    pub server: String,
    pub client: String,
    pub app: String,
}

/// The tokens the editor gets: the app's, and the one agents connect with.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorTokens {
    pub app_token: String,
    pub client_token: String,
}

impl McpTokens {
    pub fn generate() -> Result<Self, String> {
        let server = random_hex()?;
        Ok(Self {
            client: client_token(&server),
            app: random_hex()?,
            server,
        })
    }

    pub fn for_editor(&self) -> EditorTokens {
        EditorTokens {
            app_token: self.app.clone(),
            client_token: self.client.clone(),
        }
    }
}

fn random_hex() -> Result<String, String> {
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes).map_err(|e| format!("Could not make an MCP token: {e}"))?;
    Ok(hex(&bytes))
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

/// The token an MCP client connects with: an HMAC-SHA-256 of the context, keyed with the
/// server's token, as `mcpClientToken` works it out.
fn client_token(server: &str) -> String {
    let mut mac =
        Hmac::<Sha256>::new_from_slice(server.as_bytes()).expect("HMAC takes a key of any length");
    mac.update(CLIENT_TOKEN_CONTEXT);
    hex(&mac.finalize().into_bytes())
}

/// Whether a tool reads a file or writes one.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Access {
    Read,
    Write,
}

/// The server's question before a tool reads or writes a file: `stdioPathConsent` in
/// `packages/mcp/src/consent.ts`.
#[derive(Clone, Debug, PartialEq, Deserialize)]
pub struct ConsentRequest {
    pub id: u64,
    pub tool: String,
    pub access: Access,
    pub path: String,
    #[serde(default)]
    pub client: Option<String>,
}

#[derive(Deserialize)]
struct Line {
    #[serde(rename = "type")]
    kind: String,
}

/// The server's question in a line it wrote, if the line is one.
pub fn consent_request(line: &str) -> Option<ConsentRequest> {
    let kind: Line = serde_json::from_str(line).ok()?;
    if kind.kind != "consent" {
        return None;
    }
    serde_json::from_str(line).ok()
}

/// The answer line the server reads.
pub fn consent_answer(id: u64, allowed: bool) -> String {
    serde_json::json!({ "type": "consent", "id": id, "allowed": allowed }).to_string()
}

/// Whether allowing `tool` lets the editor open or save the file itself.
pub fn editor_opens(tool: &str) -> bool {
    EDITOR_FILE_TOOLS.contains(&tool)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derives_the_client_token_as_the_server_does() {
        // `mcpClientToken('server-token')` in packages/mcp.
        assert_eq!(
            client_token("server-token"),
            "d7267ed82c48e0704fb08de43858fdfe4940fd726da056ad3c54ec716f33ad5f"
        );
        let tokens = McpTokens::generate().unwrap();
        assert_eq!(tokens.server.len(), 64);
        assert_ne!(tokens.app, tokens.server);
        assert_eq!(tokens.client, client_token(&tokens.server));
    }

    #[test]
    fn reads_only_consent_lines() {
        let line = r#"{"type":"consent","id":3,"tool":"open_document","access":"write","path":"/Users/me/a.fig","client":"claude-code"}"#;
        assert_eq!(
            consent_request(line),
            Some(ConsentRequest {
                id: 3,
                tool: "open_document".to_owned(),
                access: Access::Write,
                path: "/Users/me/a.fig".to_owned(),
                client: Some("claude-code".to_owned()),
            })
        );
        assert_eq!(consent_request("OpenPencil MCP server"), None);
        assert_eq!(consent_request(r#"{"type":"other","id":1}"#), None);
        assert_eq!(
            consent_answer(3, true),
            r#"{"allowed":true,"id":3,"type":"consent"}"#
        );
        assert!(editor_opens("save_document") && !editor_opens("export_image"));
    }
}
