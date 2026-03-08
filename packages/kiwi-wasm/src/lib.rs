//! WASM Kiwi decoder for OpenPencil .fig files.
//! Decodes Kiwi binary messages using the kiwi_schema crate.

use js_sys::{Array, Object, Reflect};
use kiwi_schema::Value;
use wasm_bindgen::prelude::*;
use kiwi_schema::Schema;

/// Decode a Figma message from schema bytes and data bytes.
///
/// - `schema_bytes`: Inflated binary Kiwi schema (from .fig container chunk 0)
/// - `data`: Decompressed message data (from .fig container chunk 1)
///
/// Returns a plain JS object with the same structure as the JS decoder output.
#[wasm_bindgen]
pub fn decode_figma_message(schema_bytes: &[u8], data: &[u8]) -> Result<JsValue, JsError> {
    let schema = Schema::decode(schema_bytes).map_err(|_| JsError::new("Failed to decode schema"))?;

    let msg_def_index = schema
        .def_name_to_index
        .get("Message")
        .or_else(|| schema.def_name_to_index.get("Fig.Message"))
        .copied()
        .ok_or_else(|| JsError::new("Schema has no Message definition"))? as i32;

    let value = Value::decode(&schema, msg_def_index, data)
        .map_err(|_| JsError::new("Failed to decode message"))?;

    value_to_js(&value).map_err(|e| JsError::new(&e))
}

fn value_to_js(value: &Value) -> Result<JsValue, String> {
    Ok(match value {
        Value::Bool(v) => JsValue::from_bool(*v),
        Value::Byte(v) => JsValue::from_f64(*v as f64),
        Value::Int(v) => JsValue::from_f64(*v as f64),
        Value::UInt(v) => JsValue::from_f64(*v as f64),
        Value::Float(v) => JsValue::from_f64(*v as f64),
        Value::String(v) => JsValue::from_str(v),
        Value::Int64(v) => JsValue::from_f64(*v as f64),
        Value::UInt64(v) => JsValue::from_f64(*v as f64),
        Value::Enum(_, v) => JsValue::from_str(v),
        Value::Array(arr) => {
            let js_arr = Array::new();
            for v in arr {
                js_arr.push(&value_to_js(v)?);
            }
            js_arr.into()
        }
        Value::Object(_, fields) => {
            let obj = Object::new();
            for (k, v) in fields {
                Reflect::set(&obj, &JsValue::from_str(k), &value_to_js(v)?)
                    .map_err(|_| "Reflect::set failed")?;
            }
            obj.into()
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_placeholder() {
        // Placeholder - real tests run in JS
        assert!(true);
    }
}
