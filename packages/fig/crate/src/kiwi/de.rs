//! Kiwi as a serde format: a message decoded straight into Rust types, driven by the schema the
//! file carries. A field the target type does not name is skipped in the bytes, never decoded,
//! so a type with a few fields reads only those.

use core::fmt;

use serde::de::value::BorrowedStrDeserializer;
use serde::de::{self, DeserializeSeed, EnumAccess, MapAccess, SeqAccess, VariantAccess, Visitor};
use serde::forward_to_deserialize_any;

use super::{
    BOOL, BYTE, Definition, DefinitionKind, FLOAT, Field, INT, INT64, Malformed, Reader, STRING,
    Schema, UINT, UINT64,
};

/// Why a message did not decode into the type asked for.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Error(String);

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for Error {}

impl de::Error for Error {
    fn custom<T: fmt::Display>(message: T) -> Self {
        Error(message.to_string())
    }
}

impl From<Malformed> for Error {
    fn from(_: Malformed) -> Self {
        Error(String::from(
            "the message ends early or does not match its schema",
        ))
    }
}

/// Decodes the message of schema definition `definition` that starts at `at` in `data`.
pub fn from_message<'a, T: de::Deserialize<'a>>(
    schema: &'a Schema,
    data: &'a [u8],
    at: usize,
    definition: usize,
) -> Result<T, Error> {
    from_message_where(schema, data, at, definition, &|_| true)
}

/// `from_message` for only the message's fields `keep` accepts by name: the rest are skipped in
/// the bytes as if the message left them out.
pub fn from_message_where<'a, T: de::Deserialize<'a>>(
    schema: &'a Schema,
    data: &'a [u8],
    at: usize,
    definition: usize,
    keep: &dyn Fn(&str) -> bool,
) -> Result<T, Error> {
    let mut reader = Reader::at(data, at);
    T::deserialize(Decoder {
        reader: &mut reader,
        schema,
        ty: definition as i32,
        array: false,
        keep: Some(keep),
    })
}

/// One value of a Kiwi type, or an array of them.
struct Decoder<'r, 'a> {
    reader: &'r mut Reader<'a>,
    schema: &'a Schema,
    ty: i32,
    array: bool,
    /// Which of a message's fields to read; the others are skipped. Only the outermost message
    /// is filtered.
    keep: Option<&'r dyn Fn(&str) -> bool>,
}

impl<'a> Decoder<'_, 'a> {
    fn definition(&self) -> Result<&'a Definition, Error> {
        let at = usize::try_from(self.ty).map_err(|_| Malformed)?;
        Ok(self.schema.definitions.get(at).ok_or(Malformed)?)
    }
}

impl<'a> de::Deserializer<'a> for Decoder<'_, 'a> {
    type Error = Error;

    fn deserialize_any<V: Visitor<'a>>(self, visitor: V) -> Result<V::Value, Error> {
        let reader = self.reader;
        if self.array {
            if self.ty == BYTE {
                let length = reader.varuint()? as usize;
                let end = reader.position.checked_add(length).ok_or(Malformed)?;
                let bytes = reader.data.get(reader.position..end).ok_or(Malformed)?;
                reader.position = end;
                return visitor.visit_borrowed_bytes(bytes);
            }
            // Each element takes at least a byte, so a count past the bytes left is damaged.
            let left = reader.varuint()? as usize;
            if left > reader.data.len() - reader.position {
                return Err(Malformed.into());
            }
            return visitor.visit_seq(Elements {
                reader,
                schema: self.schema,
                ty: self.ty,
                left,
            });
        }
        match self.ty {
            BOOL => visitor.visit_bool(reader.bool()?),
            BYTE => visitor.visit_u8(reader.byte()?),
            INT => visitor.visit_i32(reader.varint()?),
            UINT => visitor.visit_u32(reader.varuint()?),
            FLOAT => visitor.visit_f64(f64::from(reader.float()?)),
            STRING => {
                let span = reader.span()?;
                let bytes: &'a [u8] = &reader.data[span.range()];
                match core::str::from_utf8(bytes) {
                    Ok(text) => visitor.visit_borrowed_str(text),
                    // As a TypeScript `TextDecoder` reads it.
                    Err(_) => visitor.visit_string(String::from_utf8_lossy(bytes).into_owned()),
                }
            }
            INT64 => {
                let value = reader.varuint64()?;
                visitor.visit_i64(if value & 1 == 0 {
                    (value >> 1) as i64
                } else {
                    !(value >> 1) as i64
                })
            }
            UINT64 => visitor.visit_u64(reader.varuint64()?),
            _ => {
                let definition = Decoder { reader, ..self }.definition()?;
                match definition.kind {
                    DefinitionKind::Enum => visitor.visit_borrowed_str(member(definition, reader)?),
                    DefinitionKind::Struct => {
                        reader.enter()?;
                        let fields = StructFields {
                            reader: &mut *reader,
                            schema: self.schema,
                            fields: &definition.fields,
                            next: 0,
                        };
                        let result = visitor.visit_map(fields);
                        reader.depth -= 1;
                        result
                    }
                    DefinitionKind::Message => {
                        reader.enter()?;
                        let fields = MessageFields {
                            reader: &mut *reader,
                            schema: self.schema,
                            definition,
                            field: None,
                            keep: self.keep,
                        };
                        let result = visitor.visit_map(fields);
                        reader.depth -= 1;
                        result
                    }
                }
            }
        }
    }

    /// A field a message holds is present; one it leaves out never reaches the decoder.
    fn deserialize_option<V: Visitor<'a>>(self, visitor: V) -> Result<V::Value, Error> {
        visitor.visit_some(self)
    }

    fn deserialize_enum<V: Visitor<'a>>(
        self,
        _: &'static str,
        _: &'static [&'static str],
        visitor: V,
    ) -> Result<V::Value, Error> {
        if self.array || self.ty < 0 {
            return self.deserialize_any(visitor);
        }
        let definition = self.definition()?;
        if definition.kind != DefinitionKind::Enum {
            return self.deserialize_any(visitor);
        }
        visitor.visit_enum(Member(member(definition, self.reader)?))
    }

    fn deserialize_ignored_any<V: Visitor<'a>>(self, visitor: V) -> Result<V::Value, Error> {
        self.reader.skip_typed(self.schema, self.ty, self.array)?;
        visitor.visit_unit()
    }

    fn deserialize_newtype_struct<V: Visitor<'a>>(
        self,
        _: &'static str,
        visitor: V,
    ) -> Result<V::Value, Error> {
        visitor.visit_newtype_struct(self)
    }

    forward_to_deserialize_any! {
        <W: Visitor<'a>>
        bool i8 i16 i32 i64 i128 u8 u16 u32 u64 u128 f32 f64 char str string bytes byte_buf unit
        unit_struct seq tuple tuple_struct map struct identifier
    }
}

/// An enum member's name; empty for a value the schema does not name, which a type's
/// `#[serde(other)]` variant takes.
fn member<'a>(definition: &'a Definition, reader: &mut Reader<'a>) -> Result<&'a str, Error> {
    let id = reader.varuint()?;
    Ok(definition
        .fields
        .iter()
        .find(|member| member.id == id)
        .map_or("", |member| member.name.as_str()))
}

struct Member<'a>(&'a str);

impl<'a> EnumAccess<'a> for Member<'a> {
    type Error = Error;
    type Variant = Self;

    fn variant_seed<V: DeserializeSeed<'a>>(self, seed: V) -> Result<(V::Value, Self), Error> {
        let name = seed.deserialize(BorrowedStrDeserializer::<Error>::new(self.0))?;
        Ok((name, self))
    }
}

impl<'a> VariantAccess<'a> for Member<'a> {
    type Error = Error;

    fn unit_variant(self) -> Result<(), Error> {
        Ok(())
    }

    fn newtype_variant_seed<T: DeserializeSeed<'a>>(self, _: T) -> Result<T::Value, Error> {
        Err(de::Error::custom("a Kiwi enum member holds no value"))
    }

    fn tuple_variant<V: Visitor<'a>>(self, _: usize, _: V) -> Result<V::Value, Error> {
        Err(de::Error::custom("a Kiwi enum member holds no value"))
    }

    fn struct_variant<V: Visitor<'a>>(
        self,
        _: &'static [&'static str],
        _: V,
    ) -> Result<V::Value, Error> {
        Err(de::Error::custom("a Kiwi enum member holds no value"))
    }
}

/// An array's elements.
struct Elements<'r, 'a> {
    reader: &'r mut Reader<'a>,
    schema: &'a Schema,
    ty: i32,
    left: usize,
}

impl<'a> SeqAccess<'a> for Elements<'_, 'a> {
    type Error = Error;

    fn next_element_seed<T: DeserializeSeed<'a>>(
        &mut self,
        seed: T,
    ) -> Result<Option<T::Value>, Error> {
        if self.left == 0 {
            return Ok(None);
        }
        self.left -= 1;
        seed.deserialize(Decoder {
            reader: &mut *self.reader,
            schema: self.schema,
            ty: self.ty,
            array: false,
            keep: None,
        })
        .map(Some)
    }

    fn size_hint(&self) -> Option<usize> {
        Some(self.left)
    }
}

/// A struct's fields, every one present and in order.
struct StructFields<'r, 'a> {
    reader: &'r mut Reader<'a>,
    schema: &'a Schema,
    fields: &'a [Field],
    next: usize,
}

impl<'a> MapAccess<'a> for StructFields<'_, 'a> {
    type Error = Error;

    fn next_key_seed<K: DeserializeSeed<'a>>(
        &mut self,
        seed: K,
    ) -> Result<Option<K::Value>, Error> {
        let Some(field) = self.fields.get(self.next) else {
            return Ok(None);
        };
        seed.deserialize(BorrowedStrDeserializer::new(field.name.as_str()))
            .map(Some)
    }

    fn next_value_seed<V: DeserializeSeed<'a>>(&mut self, seed: V) -> Result<V::Value, Error> {
        let field = &self.fields[self.next];
        self.next += 1;
        seed.deserialize(Decoder {
            reader: &mut *self.reader,
            schema: self.schema,
            ty: field.ty,
            array: field.is_array,
            keep: None,
        })
    }
}

/// A message's fields, those it holds, by their ids until the zero that ends it.
struct MessageFields<'r, 'a> {
    reader: &'r mut Reader<'a>,
    schema: &'a Schema,
    definition: &'a Definition,
    field: Option<&'a Field>,
    keep: Option<&'r dyn Fn(&str) -> bool>,
}

impl<'a> MapAccess<'a> for MessageFields<'_, 'a> {
    type Error = Error;

    fn next_key_seed<K: DeserializeSeed<'a>>(
        &mut self,
        seed: K,
    ) -> Result<Option<K::Value>, Error> {
        let field = loop {
            let id = self.reader.varuint()?;
            if id == 0 {
                return Ok(None);
            }
            let index = *self.definition.by_id.get(id as usize).ok_or(Malformed)?;
            let field = &self.definition.fields[index.checked_sub(1).ok_or(Malformed)? as usize];
            if self.keep.is_none_or(|keep| keep(&field.name)) {
                break field;
            }
            self.reader.skip_field(self.schema, field)?;
        };
        self.field = Some(field);
        seed.deserialize(BorrowedStrDeserializer::new(field.name.as_str()))
            .map(Some)
    }

    fn next_value_seed<V: DeserializeSeed<'a>>(&mut self, seed: V) -> Result<V::Value, Error> {
        let field = self.field.take().ok_or(Malformed)?;
        seed.deserialize(Decoder {
            reader: &mut *self.reader,
            schema: self.schema,
            ty: field.ty,
            array: field.is_array,
            keep: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use serde::Deserialize;

    use super::*;

    #[derive(Debug, Deserialize, PartialEq)]
    enum Kind {
        A,
        B,
        #[serde(other)]
        Unlisted,
    }

    #[derive(Debug, Deserialize, PartialEq)]
    struct Point {
        x: f64,
        y: f64,
    }

    /// A message type that names only some of the message's fields.
    #[derive(Debug, Default, Deserialize, PartialEq)]
    #[serde(default)]
    struct Partial {
        k: Option<Kind>,
        p: Option<Point>,
        n: Option<String>,
    }

    #[derive(Debug, Default, Deserialize, PartialEq)]
    #[serde(default)]
    struct Lists {
        l: Option<Vec<u32>>,
        d: Option<serde_bytes::ByteBuf>,
    }

    #[test]
    fn decodes_into_types_and_skips_what_they_leave_out() {
        // enum E { A = 0; B = 1; } struct P { float x; float y; }
        // message M { E k = 1; P p = 2; uint[] l = 3; string n = 4; byte[] d = 5; }
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
        message.extend([3, 2, 7, 8, 4, b'h', b'i', 0, 5, 2, 9, 9, 0]);
        let partial: Partial = from_message(&schema, &message, 0, 2).unwrap();
        assert_eq!(
            partial,
            Partial {
                k: Some(Kind::B),
                p: Some(Point { x: 1.0, y: 0.0 }),
                n: Some(String::from("hi")),
            }
        );
        let lists: Lists = from_message(&schema, &message, 0, 2).unwrap();
        assert_eq!(lists.l, Some(vec![7, 8]));
        assert_eq!(lists.d.map(|bytes| bytes.into_vec()), Some(vec![9, 9]));
        // A member the schema does not name, and a message cut short.
        let unnamed: Partial = from_message(&schema, &[1, 9, 0], 0, 2).unwrap();
        assert_eq!(unnamed.k, Some(Kind::Unlisted));
        assert!(from_message::<Partial>(&schema, &message[..6], 0, 2).is_err());
    }
}
