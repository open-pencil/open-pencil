//! Kiwi values decoded whole, for the fields a caller reads rather than skips: the same shape
//! the TypeScript Kiwi runtime decodes them into, so the two readers compare value by value.

use std::borrow::Cow;

use super::{
    BOOL, BYTE, DefinitionKind, FLOAT, Field, INT, INT64, Malformed, Reader, Result, STRING,
    Schema, UINT, UINT64,
};

/// A decoded value. Strings, bytes, and names borrow from the message and its schema.
#[derive(Debug, Clone, PartialEq)]
pub enum Value<'a> {
    Bool(bool),
    Byte(u8),
    Int(i32),
    Uint(u32),
    /// A float, widened from the 32 bits Kiwi stores, so arithmetic on it is done in 64 bits as
    /// the TypeScript reader does it.
    Float(f64),
    String(Cow<'a, str>),
    Int64(i64),
    Uint64(u64),
    /// An enum member by name; `None` for a value the schema does not name.
    Enum(Option<&'a str>),
    Bytes(&'a [u8]),
    Array(Vec<Value<'a>>),
    /// A struct's or message's fields by name, in the order they were read.
    Fields(Vec<(&'a str, Value<'a>)>),
    /// A field a layer sets to nothing, which clears the one below it, as a TypeScript record
    /// holds `undefined`. Never decoded, only written by the reader's own rules.
    Undefined,
}

impl<'a> Value<'a> {
    /// A field of a struct or message.
    pub fn get(&self, name: &str) -> Option<&Value<'a>> {
        match self {
            Value::Fields(fields) => fields
                .iter()
                .find(|(field, _)| *field == name)
                .map(|(_, value)| value),
            _ => None,
        }
    }

    pub fn get_mut(&mut self, name: &str) -> Option<&mut Value<'a>> {
        match self {
            Value::Fields(fields) => fields
                .iter_mut()
                .find(|(field, _)| *field == name)
                .map(|(_, value)| value),
            _ => None,
        }
    }

    /// Sets a field of a struct or message, replacing one of that name.
    pub fn set(&mut self, name: &'a str, value: Value<'a>) {
        if let Value::Fields(fields) = self {
            match fields.iter_mut().find(|(field, _)| *field == name) {
                Some((_, existing)) => *existing = value,
                None => fields.push((name, value)),
            }
        }
    }

    pub fn as_f64(&self) -> Option<f64> {
        match *self {
            Value::Float(value) => Some(value),
            Value::Int(value) => Some(f64::from(value)),
            Value::Uint(value) => Some(f64::from(value)),
            Value::Byte(value) => Some(f64::from(value)),
            _ => None,
        }
    }

    pub fn as_str(&self) -> Option<&str> {
        match self {
            Value::String(text) => Some(text),
            Value::Enum(name) => *name,
            _ => None,
        }
    }

    /// Multiplies a number in place; other values are left as they are.
    pub fn scale(&mut self, factor: f64) {
        if let Value::Float(value) = self {
            *value *= factor;
        }
    }

    /// Multiplies the named number field, when there is one.
    pub fn scale_field(&mut self, name: &str, factor: f64) {
        if let Some(value) = self.get_mut(name) {
            value.scale(factor);
        }
    }
}

impl<'a> Reader<'a> {
    /// Decodes a field's value, an array of them where the field is one.
    pub fn value(&mut self, schema: &'a Schema, field: &Field) -> Result<Value<'a>> {
        if !field.is_array {
            return self.single(schema, field.ty);
        }
        if field.ty == BYTE {
            let length = self.varuint()? as usize;
            let end = self.position.checked_add(length).ok_or(Malformed)?;
            let bytes = self.data.get(self.position..end).ok_or(Malformed)?;
            self.position = end;
            return Ok(Value::Bytes(bytes));
        }
        // Each element takes at least a byte, so a count past the bytes left is damaged.
        let count = self.varuint()? as usize;
        if count > self.data.len() - self.position {
            return Err(Malformed);
        }
        let mut values = Vec::with_capacity(count);
        for _ in 0..count {
            values.push(self.single(schema, field.ty)?);
        }
        Ok(Value::Array(values))
    }

    fn single(&mut self, schema: &'a Schema, ty: i32) -> Result<Value<'a>> {
        Ok(match ty {
            BOOL => Value::Bool(self.bool()?),
            BYTE => Value::Byte(self.byte()?),
            INT => Value::Int(self.varint()?),
            UINT => Value::Uint(self.varuint()?),
            FLOAT => Value::Float(f64::from(self.float()?)),
            STRING => {
                let span = self.span()?;
                Value::String(String::from_utf8_lossy(&self.data[span.range()]))
            }
            INT64 => {
                let value = self.varuint64()?;
                Value::Int64(if value & 1 == 0 {
                    (value >> 1) as i64
                } else {
                    !(value >> 1) as i64
                })
            }
            UINT64 => Value::Uint64(self.varuint64()?),
            _ => {
                let definition = schema.definitions.get(ty as usize).ok_or(Malformed)?;
                match definition.kind {
                    DefinitionKind::Enum => {
                        let id = self.varuint()?;
                        let member = definition.fields.iter().find(|member| member.id == id);
                        Value::Enum(member.map(|member| member.name.as_str()))
                    }
                    DefinitionKind::Struct => {
                        self.enter()?;
                        let mut fields = Vec::with_capacity(definition.fields.len());
                        let read = definition.fields.iter().try_for_each(|field| {
                            fields.push((field.name.as_str(), self.value(schema, field)?));
                            Ok(())
                        });
                        self.depth -= 1;
                        read?;
                        Value::Fields(fields)
                    }
                    DefinitionKind::Message => {
                        let mut value = Value::Fields(Vec::new());
                        self.message(schema, ty as usize, |reader, index| {
                            let field = &definition.fields[index];
                            value.set(field.name.as_str(), reader.value(schema, field)?);
                            Ok(true)
                        })?;
                        value
                    }
                }
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_messages_structs_enums_and_arrays() {
        // enum E { A = 0; B = 1; } struct P { float x; float y; }
        // message M { E kind = 1; P point = 2; uint[] list = 3; string name = 4; byte[] data = 5; }
        let schema = Schema::parse(&[
            3, b'E', 0, 0, 2, b'A', 0, 0, 0, 0, b'B', 0, 0, 0, 1, //
            b'P', 0, 1, 2, b'x', 0, 9, 0, 0, b'y', 0, 9, 0, 0, //
            b'M', 0, 2, 5, b'k', 0, 0, 0, 1, b'p', 0, 2, 0, 2, b'l', 0, 7, 1, 3, //
            b'n', 0, 11, 0, 4, b'd', 0, 3, 1, 5,
        ])
        .unwrap();
        let one = 1f32.to_bits().rotate_left(9).to_le_bytes();
        let mut message = vec![1, 1, 2];
        message.extend(one);
        message.push(0);
        message.extend([3, 2, 7, 8, 4, b'h', b'i', 0, 5, 2, 9, 9, 5, 1, 9, 0]);
        let field = Field {
            name: String::from("m"),
            ty: 2,
            is_array: false,
            id: 0,
        };
        let value = Reader::new(&message).value(&schema, &field).unwrap();
        assert_eq!(value.get("k"), Some(&Value::Enum(Some("B"))));
        let point = value.get("p").unwrap();
        assert_eq!(point.get("x").and_then(Value::as_f64), Some(1.0));
        assert_eq!(point.get("y").and_then(Value::as_f64), Some(0.0));
        assert_eq!(
            value.get("l"),
            Some(&Value::Array(vec![Value::Uint(7), Value::Uint(8)]))
        );
        assert_eq!(value.get("n").and_then(Value::as_str), Some("hi"));
        // A field read twice keeps its last value, as the TypeScript runtime does.
        assert_eq!(value.get("d"), Some(&Value::Bytes(&[9])));
    }
}
