//! Kiwi's binary schema and a cursor over a message encoded with it. Nothing is decoded into
//! values here: callers read the fields they need and the cursor skips the rest.

/// A message, or a schema, ended early or holds a value its schema does not allow.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Malformed;

pub type Result<T> = core::result::Result<T, Malformed>;

/// Field types below zero are Kiwi's primitives; the rest index the schema's definitions.
pub const BOOL: i32 = -1;
pub const BYTE: i32 = -2;
pub const INT: i32 = -3;
pub const UINT: i32 = -4;
pub const FLOAT: i32 = -5;
pub const STRING: i32 = -6;
pub const INT64: i32 = -7;
pub const UINT64: i32 = -8;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DefinitionKind {
    Enum,
    Struct,
    Message,
}

#[derive(Debug)]
pub struct Field {
    pub name: String,
    pub ty: i32,
    pub is_array: bool,
    /// A message field's id on the wire, an enum member's value.
    pub id: u32,
}

#[derive(Debug)]
pub struct Definition {
    pub name: String,
    pub kind: DefinitionKind,
    pub fields: Vec<Field>,
    /// A message field's index plus one by its id; zero where no field has that id.
    by_id: Vec<u32>,
}

#[derive(Debug)]
pub struct Schema {
    pub definitions: Vec<Definition>,
}

impl Schema {
    pub fn parse(bytes: &[u8]) -> Result<Schema> {
        let mut reader = Reader::new(bytes);
        let count = reader.varuint()?;
        let mut definitions = Vec::new();
        for _ in 0..count {
            let name = reader.string()?.to_owned();
            let kind = match reader.byte()? {
                0 => DefinitionKind::Enum,
                1 => DefinitionKind::Struct,
                2 => DefinitionKind::Message,
                _ => return Err(Malformed),
            };
            let field_count = reader.varuint()?;
            let mut fields = Vec::new();
            for _ in 0..field_count {
                let name = reader.string()?.to_owned();
                let ty = reader.varint()?;
                let is_array = reader.byte()? != 0;
                let id = reader.varuint()?;
                fields.push(Field {
                    name,
                    ty,
                    is_array,
                    id,
                });
            }
            let by_id = if kind == DefinitionKind::Message {
                let largest = fields.iter().map(|field| field.id).max().unwrap_or(0);
                let mut by_id = vec![0; largest as usize + 1];
                for (index, field) in fields.iter().enumerate() {
                    by_id[field.id as usize] = index as u32 + 1;
                }
                by_id
            } else {
                Vec::new()
            };
            definitions.push(Definition {
                name,
                kind,
                fields,
                by_id,
            });
        }
        // Every field type names a primitive or a definition; enum members carry none.
        let count = definitions.len() as i32;
        let typed = definitions
            .iter()
            .filter(|definition| definition.kind != DefinitionKind::Enum)
            .flat_map(|definition| &definition.fields);
        for field in typed {
            if !(UINT64..=BOOL).contains(&field.ty) && !(0..count).contains(&field.ty) {
                return Err(Malformed);
            }
        }
        Ok(Schema { definitions })
    }

    pub fn definition(&self, name: &str) -> Option<usize> {
        self.definitions
            .iter()
            .position(|definition| definition.name == name)
    }

    /// The index of a named field, or `None` when the schema has no such definition or field.
    pub fn field(&self, definition: Option<usize>, name: &str) -> Option<usize> {
        self.definitions[definition?]
            .fields
            .iter()
            .position(|field| field.name == name)
    }

    /// The value of a named enum member, or `None` when the schema lacks it.
    pub fn enum_value(&self, definition: Option<usize>, name: &str) -> Option<u32> {
        self.definitions[definition?]
            .fields
            .iter()
            .find(|field| field.name == name)
            .map(|field| field.id)
    }
}

/// A cursor over an encoded message.
pub struct Reader<'a> {
    data: &'a [u8],
    pub position: usize,
}

impl<'a> Reader<'a> {
    pub fn new(data: &'a [u8]) -> Self {
        Reader { data, position: 0 }
    }

    pub fn at(data: &'a [u8], position: usize) -> Self {
        Reader { data, position }
    }

    #[inline]
    pub fn byte(&mut self) -> Result<u8> {
        let byte = *self.data.get(self.position).ok_or(Malformed)?;
        self.position += 1;
        Ok(byte)
    }

    #[inline]
    pub fn bool(&mut self) -> Result<bool> {
        Ok(self.byte()? != 0)
    }

    #[inline]
    pub fn varuint(&mut self) -> Result<u32> {
        let mut shift = 0;
        let mut value = 0u32;
        loop {
            let byte = self.byte()?;
            value |= u32::from(byte & 127) << shift;
            if byte < 128 || shift >= 28 {
                return Ok(value);
            }
            shift += 7;
        }
    }

    #[inline]
    pub fn varint(&mut self) -> Result<i32> {
        let value = self.varuint()?;
        Ok(if value & 1 == 0 {
            (value >> 1) as i32
        } else {
            !(value >> 1) as i32
        })
    }

    #[inline]
    fn varuint64(&mut self) -> Result<u64> {
        let mut shift = 0;
        let mut value = 0u64;
        loop {
            let byte = self.byte()?;
            if byte & 128 != 0 && shift < 56 {
                value |= u64::from(byte & 127) << shift;
                shift += 7;
            } else {
                return Ok(value | u64::from(byte) << shift);
            }
        }
    }

    /// Kiwi's float: a zero byte for 0, else four bytes with the exponent moved to the front.
    #[inline]
    pub fn float(&mut self) -> Result<f32> {
        let first = self.byte()?;
        if first == 0 {
            return Ok(0.0);
        }
        let rest = self
            .data
            .get(self.position..self.position + 3)
            .ok_or(Malformed)?;
        self.position += 3;
        let bits = u32::from(first)
            | u32::from(rest[0]) << 8
            | u32::from(rest[1]) << 16
            | u32::from(rest[2]) << 24;
        Ok(f32::from_bits(bits.rotate_right(9)))
    }

    /// A null-terminated string, as the span of its bytes.
    #[inline]
    pub fn span(&mut self) -> Result<Span> {
        let start = self.position;
        let length = self
            .data
            .get(start..)
            .ok_or(Malformed)?
            .iter()
            .position(|&byte| byte == 0);
        let length = length.ok_or(Malformed)?;
        self.position = start + length + 1;
        Ok(Span {
            start: start as u32,
            length: length as u32,
        })
    }

    fn string(&mut self) -> Result<&'a str> {
        let span = self.span()?;
        core::str::from_utf8(&self.data[span.range()]).map_err(|_| Malformed)
    }

    /// Figma's `GUID` struct as one number, its session in the high half.
    #[inline]
    pub fn guid(&mut self) -> Result<u64> {
        let session = u64::from(self.varuint()?);
        let local = u64::from(self.varuint()?);
        Ok(session << 32 | local)
    }

    pub fn skip(&mut self, schema: &Schema, ty: i32) -> Result<()> {
        match ty {
            BOOL | BYTE => {
                self.byte()?;
            }
            INT | UINT => {
                self.varuint()?;
            }
            FLOAT => {
                self.float()?;
            }
            STRING => {
                self.span()?;
            }
            INT64 | UINT64 => {
                self.varuint64()?;
            }
            _ => {
                let definition = schema.definitions.get(ty as usize).ok_or(Malformed)?;
                match definition.kind {
                    DefinitionKind::Enum => {
                        self.varuint()?;
                    }
                    DefinitionKind::Struct => {
                        for field in &definition.fields {
                            self.skip_field(schema, field)?;
                        }
                    }
                    DefinitionKind::Message => {
                        self.message(schema, ty as usize, |_, _| Ok(false))?
                    }
                }
            }
        }
        Ok(())
    }

    pub fn skip_field(&mut self, schema: &Schema, field: &Field) -> Result<()> {
        if !field.is_array {
            return self.skip(schema, field.ty);
        }
        if field.ty == BYTE {
            let length = self.varuint()? as usize;
            let end = self.position.checked_add(length).ok_or(Malformed)?;
            if end > self.data.len() {
                return Err(Malformed);
            }
            self.position = end;
            return Ok(());
        }
        for _ in 0..self.varuint()? {
            self.skip(schema, field.ty)?;
        }
        Ok(())
    }

    /// Walks a message's fields. `visit` gets each field's index in the definition and returns
    /// whether it read the value; a value it leaves is skipped.
    pub fn message(
        &mut self,
        schema: &Schema,
        definition: usize,
        mut visit: impl FnMut(&mut Reader<'a>, usize) -> Result<bool>,
    ) -> Result<()> {
        let definition = &schema.definitions[definition];
        loop {
            let id = self.varuint()?;
            if id == 0 {
                return Ok(());
            }
            let index = *definition.by_id.get(id as usize).ok_or(Malformed)?;
            let index = index.checked_sub(1).ok_or(Malformed)? as usize;
            if !visit(self, index)? {
                self.skip_field(schema, &definition.fields[index])?;
            }
        }
    }

    /// Reads an array of values, handing the cursor to `each` once per element.
    pub fn array(&mut self, mut each: impl FnMut(&mut Reader<'a>) -> Result<()>) -> Result<()> {
        for _ in 0..self.varuint()? {
            each(self)?;
        }
        Ok(())
    }
}

/// Bytes of the message by where they start and how many there are.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Span {
    pub start: u32,
    pub length: u32,
}

impl Span {
    pub fn range(self) -> core::ops::Range<usize> {
        self.start as usize..(self.start + self.length) as usize
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_variable_length_numbers() {
        let mut reader = Reader::new(&[0x96, 0x01, 0x03, 0x04]);
        assert_eq!(reader.varuint(), Ok(150));
        assert_eq!(reader.varint(), Ok(-2));
        assert_eq!(reader.varint(), Ok(2));
        assert_eq!(reader.varuint(), Err(Malformed));
    }

    #[test]
    fn reads_floats_with_the_exponent_first() {
        // 1.0 is 0x3f800000; Kiwi stores it rotated so the exponent byte leads.
        let bits = 0x3f80_0000u32;
        let stored = bits.rotate_left(9).to_le_bytes();
        let mut reader = Reader::new(&stored);
        assert_eq!(reader.float(), Ok(1.0));
        assert_eq!(Reader::new(&[0]).float(), Ok(0.0));
    }

    #[test]
    fn walks_and_skips_message_fields() {
        // message Point { uint x = 1; string label = 2; }
        let schema_bytes = [1, b'P', 0, 2, 2, b'x', 0, 7, 0, 1, b'l', 0, 11, 0, 2];
        let schema = Schema::parse(&schema_bytes).unwrap();
        let point = schema.definition("P").unwrap();
        let x = schema.field(Some(point), "x").unwrap();
        // x = 5, l = "hi", end
        let message = [1, 5, 2, b'h', b'i', 0, 0];
        let mut seen = Vec::new();
        Reader::new(&message)
            .message(&schema, point, |reader, field| {
                if field == x {
                    seen.push(reader.varuint()?);
                    return Ok(true);
                }
                Ok(false)
            })
            .unwrap();
        assert_eq!(seen, [5]);
        let mut reader = Reader::new(&message);
        reader.skip(&schema, point as i32).unwrap();
        assert_eq!(reader.position, message.len());
        assert_eq!(
            Reader::new(&message[..4]).skip(&schema, point as i32),
            Err(Malformed)
        );
    }
}
