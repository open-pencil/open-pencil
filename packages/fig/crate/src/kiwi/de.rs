//! Kiwi as a serde format: a message decoded straight into Rust types, driven by the schema the
//! file carries. A field the target type does not name is skipped in the bytes, never decoded,
//! so a type with a few fields reads only those.

use core::fmt;
use std::borrow::Cow;

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

impl<'r, 'a> Decoder<'r, 'a> {
    /// A scalar: a primitive or an enum member's name.
    fn scalar<V: Visitor<'a>>(self, visitor: V) -> Result<V::Value, Error> {
        let reader = self.reader;
        if self.array {
            return Err(de::Error::custom("expected a value, found an array"));
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
                match super::text(bytes) {
                    Cow::Borrowed(text) => visitor.visit_borrowed_str(text),
                    Cow::Owned(text) => visitor.visit_string(text),
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
                if definition.kind != DefinitionKind::Enum {
                    return Err(de::Error::custom(
                        "expected a value, found a struct or message",
                    ));
                }
                visitor.visit_borrowed_str(member(definition, reader)?)
            }
        }
    }

    /// A byte array, borrowed from the message.
    fn bytes<V: Visitor<'a>>(self, visitor: V) -> Result<V::Value, Error> {
        if !self.array || self.ty != BYTE {
            return Err(de::Error::custom("expected a byte array"));
        }
        let reader = self.reader;
        let length = reader.varuint()? as usize;
        let end = reader.position.checked_add(length).ok_or(Malformed)?;
        let bytes = reader.data.get(reader.position..end).ok_or(Malformed)?;
        reader.position = end;
        visitor.visit_borrowed_bytes(bytes)
    }

    /// An array's elements.
    fn elements<V: Visitor<'a>>(self, visitor: V) -> Result<V::Value, Error> {
        if !self.array || self.ty == BYTE {
            return Err(de::Error::custom("expected an array"));
        }
        let reader = self.reader;
        // Each element takes at least a byte, so a count past the bytes left is damaged.
        let left = reader.varuint()? as usize;
        if left > reader.data.len() - reader.position {
            return Err(Malformed.into());
        }
        let mut elements = Elements {
            reader,
            schema: self.schema,
            ty: self.ty,
            left,
        };
        let value = visitor.visit_seq(&mut elements)?;
        // Unread elements would be taken for the fields after the array.
        if elements.left != 0 {
            return Err(de::Error::custom(
                "the array has more elements than its type",
            ));
        }
        Ok(value)
    }

    /// A struct's or a message's fields.
    fn fields<V: Visitor<'a>>(self, visitor: V) -> Result<V::Value, Error> {
        if self.array || self.ty < 0 {
            return Err(de::Error::custom("expected a struct or message"));
        }
        let definition = self.definition()?;
        let shape = match definition.kind {
            DefinitionKind::Struct => Shape::Struct { next: 0 },
            DefinitionKind::Message => Shape::Message {
                field: None,
                keep: self.keep,
            },
            DefinitionKind::Enum => {
                return Err(de::Error::custom(
                    "expected a struct or message, found an enum",
                ));
            }
        };
        let reader = self.reader;
        reader.enter()?;
        let mut fields = Fields {
            reader: &mut *reader,
            schema: self.schema,
            definition,
            shape,
            done: false,
        };
        let result = visitor.visit_map(&mut fields);
        let done = fields.done;
        reader.depth -= 1;
        let value = result?;
        // Unread fields would be taken for the ones after this value.
        if !done {
            return Err(de::Error::custom(
                "the value has fields its type did not read",
            ));
        }
        Ok(value)
    }
}

/// Each serde method reads only the shape its type asks for, so a type's visitor is compiled for
/// that shape alone rather than for every shape a Kiwi value can take.
impl<'a> de::Deserializer<'a> for Decoder<'_, 'a> {
    type Error = Error;

    fn deserialize_any<V: Visitor<'a>>(self, visitor: V) -> Result<V::Value, Error> {
        if self.array {
            if self.ty == BYTE {
                return self.bytes(visitor);
            }
            return self.elements(visitor);
        }
        if self.ty >= 0 && self.definition()?.kind != DefinitionKind::Enum {
            return self.fields(visitor);
        }
        self.scalar(visitor)
    }

    fn deserialize_struct<V: Visitor<'a>>(
        self,
        _: &'static str,
        _: &'static [&'static str],
        visitor: V,
    ) -> Result<V::Value, Error> {
        self.fields(visitor)
    }

    fn deserialize_map<V: Visitor<'a>>(self, visitor: V) -> Result<V::Value, Error> {
        self.fields(visitor)
    }

    fn deserialize_seq<V: Visitor<'a>>(self, visitor: V) -> Result<V::Value, Error> {
        self.elements(visitor)
    }

    fn deserialize_bytes<V: Visitor<'a>>(self, visitor: V) -> Result<V::Value, Error> {
        self.bytes(visitor)
    }

    fn deserialize_byte_buf<V: Visitor<'a>>(self, visitor: V) -> Result<V::Value, Error> {
        self.bytes(visitor)
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
            return Err(de::Error::custom("expected an enum member"));
        }
        let definition = self.definition()?;
        if definition.kind != DefinitionKind::Enum {
            return Err(de::Error::custom("expected an enum member"));
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

    fn deserialize_bool<V: Visitor<'a>>(self, visitor: V) -> Result<V::Value, Error> {
        self.scalar(visitor)
    }

    fn deserialize_u8<V: Visitor<'a>>(self, visitor: V) -> Result<V::Value, Error> {
        self.scalar(visitor)
    }

    fn deserialize_i32<V: Visitor<'a>>(self, visitor: V) -> Result<V::Value, Error> {
        self.scalar(visitor)
    }

    fn deserialize_u32<V: Visitor<'a>>(self, visitor: V) -> Result<V::Value, Error> {
        self.scalar(visitor)
    }

    fn deserialize_i64<V: Visitor<'a>>(self, visitor: V) -> Result<V::Value, Error> {
        self.scalar(visitor)
    }

    fn deserialize_u64<V: Visitor<'a>>(self, visitor: V) -> Result<V::Value, Error> {
        self.scalar(visitor)
    }

    fn deserialize_f64<V: Visitor<'a>>(self, visitor: V) -> Result<V::Value, Error> {
        self.scalar(visitor)
    }

    fn deserialize_str<V: Visitor<'a>>(self, visitor: V) -> Result<V::Value, Error> {
        self.scalar(visitor)
    }

    fn deserialize_string<V: Visitor<'a>>(self, visitor: V) -> Result<V::Value, Error> {
        self.scalar(visitor)
    }

    forward_to_deserialize_any! {
        <W: Visitor<'a>>
        i8 i16 i128 u16 u128 f32 char unit unit_struct tuple tuple_struct identifier
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

/// How a definition's fields are laid out.
enum Shape<'r, 'a> {
    /// A struct: every field, in order.
    Struct { next: usize },
    /// A message: the fields it holds, by their ids until the zero that ends it, those `keep`
    /// rejects skipped.
    Message {
        field: Option<&'a Field>,
        keep: Option<&'r dyn Fn(&str) -> bool>,
    },
}

/// A struct's or a message's fields, one type for both so a visitor is compiled once.
struct Fields<'r, 'a> {
    reader: &'r mut Reader<'a>,
    schema: &'a Schema,
    definition: &'a Definition,
    shape: Shape<'r, 'a>,
    /// Whether the visitor reached the end: past a struct's last field, a message's zero.
    done: bool,
}

impl<'a> Fields<'_, 'a> {
    /// The next field, or `None` past the last.
    fn next_field(&mut self) -> Result<Option<&'a Field>, Error> {
        match &mut self.shape {
            Shape::Struct { next } => {
                let field = self.definition.fields.get(*next);
                self.done = field.is_none();
                Ok(field)
            }
            Shape::Message { field, keep } => loop {
                let id = self.reader.varuint()?;
                if id == 0 {
                    self.done = true;
                    return Ok(None);
                }
                let (_, found) = self.definition.field_by_id(id)?;
                if keep.is_none_or(|keep| keep(&found.name)) {
                    *field = Some(found);
                    return Ok(Some(found));
                }
                self.reader.skip_field(self.schema, found)?;
            },
        }
    }
}

impl<'a> MapAccess<'a> for Fields<'_, 'a> {
    type Error = Error;

    fn next_key_seed<K: DeserializeSeed<'a>>(
        &mut self,
        seed: K,
    ) -> Result<Option<K::Value>, Error> {
        let Some(field) = self.next_field()? else {
            return Ok(None);
        };
        seed.deserialize(BorrowedStrDeserializer::new(field.name.as_str()))
            .map(Some)
    }

    fn next_value_seed<V: DeserializeSeed<'a>>(&mut self, seed: V) -> Result<V::Value, Error> {
        let field = match &mut self.shape {
            Shape::Struct { next } => {
                let field = self.definition.fields.get(*next).ok_or(Malformed)?;
                *next += 1;
                field
            }
            Shape::Message { field, .. } => field.take().ok_or(Malformed)?,
        };
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
        // One leading byte order mark is dropped, as a `TextDecoder` drops it.
        let marked: Partial = from_message(
            &schema,
            &[4, 0xEF, 0xBB, 0xBF, b'A', 0xEF, 0xBB, 0xBF, 0, 0],
            0,
            2,
        )
        .unwrap();
        assert_eq!(marked.n.as_deref(), Some("A\u{FEFF}"));
    }

    #[derive(Debug, Default, Deserialize)]
    #[serde(default)]
    struct Short {
        l: Option<(u32,)>,
    }

    #[test]
    fn rejects_values_their_type_leaves_unread() {
        // message M { uint[] l = 1; }
        let schema = Schema::parse(&[1, b'M', 0, 2, 1, b'l', 0, 7, 1, 1]).unwrap();
        // Two elements for a type that reads one, with the message's zero after them.
        assert!(from_message::<Short>(&schema, &[1, 2, 7, 0, 0], 0, 0).is_err());
        let one: Short = from_message(&schema, &[1, 1, 7, 0], 0, 0).unwrap();
        assert_eq!(one.l, Some((7,)));
    }

    #[derive(Debug, Default, Deserialize)]
    #[serde(default)]
    struct Blend {
        k: Option<crate::model::BlendMode>,
    }

    #[test]
    fn keeps_the_name_of_a_member_the_model_does_not_list() {
        // enum E { NORMAL = 0; EXTRA_BLEND = 1; } message M { E k = 1; }
        let schema = Schema::parse(&[
            2, b'E', 0, 0, 2, b'N', b'O', b'R', b'M', b'A', b'L', 0, 0, 0, 0, //
            b'E', b'X', b'T', b'R', b'A', b'_', b'B', b'L', b'E', b'N', b'D', 0, 0, 0, 1, //
            b'M', 0, 2, 1, b'k', 0, 0, 0, 1,
        ])
        .unwrap();
        let normal: Blend = from_message(&schema, &[1, 0, 0], 0, 1).unwrap();
        assert_eq!(normal.k, Some(crate::model::BlendMode::Normal));
        let extra: Blend = from_message(&schema, &[1, 1, 0], 0, 1).unwrap();
        let extra = extra.k.unwrap();
        assert_eq!(
            extra,
            crate::model::BlendMode::Unlisted("EXTRA_BLEND".into())
        );
        assert_eq!(serde_json::to_string(&extra).unwrap(), r#""EXTRA_BLEND""#);
    }
}
