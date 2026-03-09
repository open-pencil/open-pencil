//! WASM Kiwi decoder for OpenPencil .fig files.
//! Decodes Kiwi binary messages using the kiwi_schema crate.

use kiwi_schema::Value;
use serde::{Serialize, ser::{SerializeMap, SerializeSeq, Serializer}};
use wasm_bindgen::prelude::*;
use kiwi_schema::Schema;

struct SerializableValue<'a>(&'a Value<'a>);

impl<'a> Serialize for SerializableValue<'a> {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self.0 {
            Value::Bool(v) => serializer.serialize_bool(*v),
            Value::Byte(v) => serializer.serialize_u8(*v),
            Value::Int(v) => serializer.serialize_i32(*v),
            Value::UInt(v) => serializer.serialize_u32(*v),
            Value::Float(v) => serializer.serialize_f32(*v),
            Value::String(v) => serializer.serialize_str(v),
            Value::Int64(v) => serializer.serialize_f64(*v as f64),
            Value::UInt64(v) => serializer.serialize_f64(*v as f64),
            Value::Enum(_, v) => serializer.serialize_str(v),
            Value::Array(arr) => {
                let mut seq = serializer.serialize_seq(Some(arr.len()))?;
                for v in arr {
                    seq.serialize_element(&SerializableValue(v))?;
                }
                seq.end()
            }
            Value::Object(_, fields) => {
                let mut map = serializer.serialize_map(Some(fields.len()))?;
                for (k, v) in fields {
                    map.serialize_entry(k, &SerializableValue(v))?;
                }
                map.end()
            }
        }
    }
}

/// Decode a Figma message from schema bytes and data bytes.
///
/// - `schema_bytes`: Inflated binary Kiwi schema (from .fig container chunk 0)
/// - `data`: Decompressed message data (from .fig container chunk 1)
///
/// Returns a plain JS object with the same structure as the JS decoder output.
#[wasm_bindgen]
pub fn decode_figma_message(schema_bytes: &[u8], data: &[u8]) -> Result<JsValue, JsError> {
    let schema = Schema::decode(schema_bytes)
        .map_err(|_| JsError::new("Failed to decode schema"))?;

    let msg_def_index = schema
        .def_name_to_index
        .get("Message")
        .or_else(|| schema.def_name_to_index.get("Fig.Message"))
        .copied()
        .ok_or_else(|| JsError::new("Schema has no Message definition"))? as i32;

    let value = Value::decode(&schema, msg_def_index, data)
        .map_err(|_| JsError::new("Failed to decode message"))?;

    // serialize_maps_as_objects: Kiwi Object values must become plain JS objects
    // (not Map instances) so JS code can access properties like message.nodeChanges
    let serializer = serde_wasm_bindgen::Serializer::new().serialize_maps_as_objects(true);
    SerializableValue(&value).serialize(&serializer)
        .map_err(|e| JsError::new(&format!("Serialization failed: {}", e)))
}
