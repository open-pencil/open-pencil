//! JSON-RPC 2.0 as ACP carries it: request ids, and the messages the app writes in an agent's or
//! the editor's place.

use std::hash::{Hash, Hasher};

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// The error code the app's refusals carry: the request's parameters were not accepted.
const INVALID_PARAMS: i32 = -32602;

/// A request's id, as the sender wrote it. JSON-RPC allows a number or a string, and the app keeps
/// whatever it got, so a request and its answer match by the id's JSON text.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(transparent)]
pub struct Id(Value);

impl Id {
    pub fn string(id: String) -> Self {
        Self(Value::String(id))
    }

    /// The id of a message, if it has one.
    pub fn of(message: &serde_json::Map<String, Value>) -> Option<Self> {
        message
            .get("id")
            .filter(|id| !id.is_null())
            .cloned()
            .map(Self)
    }

    pub fn as_str(&self) -> Option<&str> {
        self.0.as_str()
    }

    fn key(&self) -> String {
        self.0.to_string()
    }
}

impl PartialEq for Id {
    fn eq(&self, other: &Self) -> bool {
        self.key() == other.key()
    }
}

impl Eq for Id {}

impl Hash for Id {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.key().hash(state);
    }
}

#[derive(Serialize)]
struct Request<'a, P> {
    jsonrpc: &'static str,
    id: &'a Id,
    method: &'a str,
    params: P,
}

#[derive(Serialize)]
struct Success<'a, R> {
    jsonrpc: &'static str,
    id: &'a Id,
    result: R,
}

#[derive(Serialize)]
struct Failure<'a> {
    jsonrpc: &'static str,
    id: &'a Id,
    error: Error<'a>,
}

#[derive(Serialize)]
struct Error<'a> {
    code: i32,
    message: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<Value>,
}

fn line(message: &impl Serialize) -> String {
    serde_json::to_string(message).expect("a JSON-RPC message serializes")
}

/// A request of the app's own.
pub fn request(id: &Id, method: &str, params: impl Serialize) -> String {
    line(&Request {
        jsonrpc: "2.0",
        id,
        method,
        params,
    })
}

/// An answer to the request `id`.
pub fn success(id: &Id, result: impl Serialize) -> String {
    line(&Success {
        jsonrpc: "2.0",
        id,
        result,
    })
}

/// A refusal of the request `id`, with `data` saying more when the reader tells refusals apart.
pub fn failure(id: &Id, message: &str, data: Option<Value>) -> String {
    line(&Failure {
        jsonrpc: "2.0",
        id,
        error: Error {
            code: INVALID_PARAMS,
            message,
            data,
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn matches_ids_by_their_json() {
        let parse = |text: &str| serde_json::from_str::<Id>(text).unwrap();
        assert_eq!(parse("3"), parse("3"));
        assert_ne!(parse("3"), parse("\"3\""));
        assert_eq!(parse("\"openpencil-1\"").as_str(), Some("openpencil-1"));
    }

    #[test]
    fn writes_answers_and_refusals() {
        let id = Id::string("r1".to_owned());
        assert_eq!(
            serde_json::from_str::<Value>(&success(&id, json!({ "ok": 1 }))).unwrap(),
            json!({ "jsonrpc": "2.0", "id": "r1", "result": { "ok": 1 } })
        );
        assert_eq!(
            serde_json::from_str::<Value>(&failure(&id, "no", None)).unwrap(),
            json!({ "jsonrpc": "2.0", "id": "r1", "error": { "code": -32602, "message": "no" } })
        );
    }
}
