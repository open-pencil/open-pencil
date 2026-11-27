//! An expanded page's field values, following how the TypeScript reader builds an occurrence's
//! properties (`packages/fig/src/instance-overrides/occurrence/create.ts`, `occurrence/claims.ts`,
//! `scale/`, `resize.ts`, and `derived-symbol-data.ts`): the expansion's steps replayed in order,
//! each layer's fields over the ones before it. Each entry is read as the reader prepares a
//! record (`packages/fig/src/document/read.ts`): property records normalized, library references
//! resolved, and the fields of the styles it names copied in.
//!
//! Sizes and positions are replayed for the whole page at once, since an instance's resize
//! moves its layers by their own constraints and sizes. Every other field is replayed for one
//! occurrence when it is asked for.

mod cleared;
mod geometry;
mod maps;
mod records;
mod references;
mod replay;
mod scale;
mod styles;

use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;

use crate::Error;
use crate::expand::{
    Expansion, INHERITED, Layer, MODES, SCALED, SIZE, SWAPPED_PAINT, Source, Step,
};
use crate::index::{Index, NO_GUID, NONE};
use crate::kiwi::{Field, Reader, Schema, Span, Value};
pub use geometry::Geometry;
use replay::Replay;
use scale::scale;

/// A component's identity and how it sits in its parent, which an instance does not take from
/// it (`UNINHERITED_COMPONENT_FIELDS` in `instance-overrides/fields.ts`).
const UNINHERITED: &[&str] = &[
    "componentKey",
    "sourceLibraryKey",
    "publishID",
    "publishedVersion",
    "sharedSymbolVersion",
    "isSymbolPublishable",
    "variantPropSpecs",
    "componentPropDefs",
    "overrideKey",
    "stackChildAlignSelf",
    "stackChildPrimaryGrow",
    "stackPositioning",
    "horizontalConstraint",
    "verticalConstraint",
];

/// Every field a uniform scale touches, which an instance record keeps in placed space
/// (`SCALED_FIELDS`).
const SCALED_FIELDS: &[&str] = &[
    "stackPadding",
    "stackSpacing",
    "stackCounterSpacing",
    "stackHorizontalPadding",
    "stackVerticalPadding",
    "stackPaddingRight",
    "stackPaddingBottom",
    "strokeWeight",
    "cornerRadius",
    "rectangleTopLeftCornerRadius",
    "rectangleTopRightCornerRadius",
    "rectangleBottomLeftCornerRadius",
    "rectangleBottomRightCornerRadius",
    "fontSize",
    "lineHeight",
    "letterSpacing",
    "textData",
    "derivedTextData",
    "dashPattern",
    "effects",
    "size",
    "transform",
];

/// The fields saved derived data sets (`applyDerivedEntry`).
const DERIVED_FIELDS: &[&str] = &[
    "derivedTextData",
    "fontSize",
    "lineHeight",
    "letterSpacing",
    "size",
    "transform",
    "fillGeometry",
    "strokeGeometry",
    "vectorData",
];

/// An override entry's structural fields, which are not property values (`ownLayers`).
const STRUCTURAL_FIELDS: &[&str] = &["guidPath", "overriddenSymbolID", "componentPropAssignments"];

/// Whether a layer applies the field `name` of its entry.
fn keeps(layer: &Layer, name: &str) -> bool {
    let only = layer.only;
    if only & INHERITED != 0 && UNINHERITED.contains(&name) {
        return false;
    }
    if only & SWAPPED_PAINT != 0 && (name == "fillPaints" || name == "styleIdForFill") {
        return false;
    }
    if only & SCALED != 0 && !SCALED_FIELDS.contains(&name) {
        return false;
    }
    if only & SIZE != 0 && name != "size" {
        return false;
    }
    if only & MODES != 0 && name != "variableModeBySetMap" {
        return false;
    }
    match layer.source {
        Source::Override(_) => !STRUCTURAL_FIELDS.contains(&name),
        Source::Derived(_) => DERIVED_FIELDS.contains(&name),
        _ => true,
    }
}

/// The field values of one expanded page.
pub struct Properties<'a> {
    expansion: &'a Expansion<'a>,
    index: &'a Index,
    schema: &'a Schema,
    message: &'a [u8],
    /// Where each occurrence's layers start in `layers`; one past the end for the last.
    layer_start: Vec<u32>,
    /// Step indices of layers, grouped by target, each group in application order.
    layers: Vec<u32>,
    /// Step indices of scales, grouped by owner as `layers` is.
    scale_start: Vec<u32>,
    scales: Vec<u32>,
    pub geometry: Vec<Geometry>,
    assets: references::Assets<'a>,
    /// Whole records prepared as the reader prepares them, by record: styles, and the records
    /// a claim clearing a style is completed from.
    prepared: RefCell<HashMap<u32, Rc<Value<'a>>>>,
    /// Records being prepared, so a style that names itself names nothing.
    preparing: RefCell<Vec<u32>>,
}

impl<'a> Properties<'a> {
    pub fn new(
        expansion: &'a Expansion<'a>,
        index: &'a Index,
        schema: &'a Schema,
        message: &'a [u8],
    ) -> crate::Result<Properties<'a>> {
        let count = expansion.occurrences.len();
        let group = |key: &dyn Fn(&Step) -> Option<u32>| {
            let mut start = vec![0u32; count + 1];
            for step in &expansion.steps {
                if let Some(target) = key(step) {
                    start[target as usize + 1] += 1;
                }
            }
            for at in 1..start.len() {
                start[at] += start[at - 1];
            }
            let mut next = start.clone();
            let mut grouped = vec![0u32; start[count] as usize];
            for (at, step) in expansion.steps.iter().enumerate() {
                if let Some(target) = key(step) {
                    grouped[next[target as usize] as usize] = at as u32;
                    next[target as usize] += 1;
                }
            }
            (start, grouped)
        };
        let (layer_start, layers) = group(&|step| match step {
            Step::Layer(layer) => Some(layer.target),
            _ => None,
        });
        let (scale_start, scales) = group(&|step| match step {
            Step::Scale { owner, .. } => Some(*owner),
            _ => None,
        });
        let mut properties = Properties {
            expansion,
            index,
            schema,
            message,
            layer_start,
            layers,
            scale_start,
            scales,
            geometry: Vec::new(),
            assets: references::Assets::new(index, message),
            prepared: RefCell::new(HashMap::new()),
            preparing: RefCell::new(Vec::new()),
        };
        properties.geometry = properties.replay_geometry()?;
        Ok(properties)
    }

    /// An entry's bytes, or `None` for a layer whose values are not an entry's.
    fn span(&self, source: Source) -> Option<Span> {
        let index = self.index;
        match source {
            Source::Record(record) => Some(index.records[record as usize].span),
            Source::Override(at) => Some(index.overrides[at as usize].span),
            Source::Derived(at) => Some(index.derived[at as usize].span),
            Source::DefaultName(record) if record != NONE => {
                Some(index.records[record as usize].span)
            }
            _ => None,
        }
    }

    /// Visits the fields of an entry, by name, with a reader at each value: `visit` returns
    /// whether it read the value, which `Visit::value` decodes.
    fn fields(
        &self,
        span: Span,
        mut visit: impl FnMut(&'a str, &mut Visit<'_, 'a>) -> crate::Result<bool>,
    ) -> crate::Result<()> {
        let schema = self.schema;
        let definition = &schema.definitions[self.index.ids.node_change];
        Reader::at(self.message, span.start as usize)
            .message(schema, self.index.ids.node_change, |reader, at| {
                let field = &definition.fields[at];
                let mut at_value = Visit {
                    reader,
                    field,
                    schema,
                };
                visit(field.name.as_str(), &mut at_value).map_err(|_| crate::kiwi::Malformed)
            })
            .map_err(|_| Error::Message)
    }

    /// One field of a record, unprepared.
    fn record_field(&self, record: u32, wanted: &str) -> crate::Result<Option<Value<'a>>> {
        let mut value = None;
        self.fields(self.index.records[record as usize].span, |name, reader| {
            if name != wanted {
                return Ok(false);
            }
            value = Some(reader.value()?);
            Ok(true)
        })?;
        Ok(value)
    }

    /// Readies an entry's fields as the reader readies a record it reads whole: property records
    /// normalized, library references resolved, and, outside saved derived data, the fields of
    /// the styles it names. `top` marks a layer, whose cleared fields clear the ones below.
    fn prepare(&self, entry: &mut Value<'a>, derived: bool, top: bool) {
        if !derived {
            records::normalize(entry);
        }
        references::resolve(entry, &self.assets, self.index);
        if !derived {
            styles::resolve(entry, &|reference| self.style(reference), top);
        }
    }

    /// A record whole and prepared, once per record.
    fn prepared(&self, record: u32) -> Option<Rc<Value<'a>>> {
        if let Some(value) = self.prepared.borrow().get(&record) {
            return Some(value.clone());
        }
        if self.preparing.borrow().contains(&record) {
            return None;
        }
        self.preparing.borrow_mut().push(record);
        let mut value = Value::Fields(Vec::new());
        let read = self.fields(self.index.records[record as usize].span, |name, reader| {
            value.set(name, reader.value()?);
            Ok(true)
        });
        if read.is_ok() {
            self.prepare(&mut value, false, false);
        }
        self.preparing.borrow_mut().pop();
        read.ok()?;
        let value = Rc::new(value);
        self.prepared.borrow_mut().insert(record, value.clone());
        Some(value)
    }

    /// The style a reference names, by its GUID or its library key, prepared.
    fn style(&self, reference: &Value<'a>) -> Option<Value<'a>> {
        let record = match reference.get("guid") {
            Some(guid) => self.index.find(guid_of(guid)?)?,
            None => self.assets.style(reference.get("assetRef")?)?,
        };
        self.prepared(record).map(|style| (*style).clone())
    }

    /// An instance's complete assignment list, leaving out assignments of slot content the file
    /// no longer has, which fall back to their component's content.
    fn assignments(&self, list: u32) -> crate::Result<Value<'a>> {
        let mut assignments = Vec::new();
        for &source in &self.expansion.assignment_lists[list as usize] {
            let Some(span) = self.span(source) else {
                continue;
            };
            self.fields(span, |name, reader| {
                if name != "componentPropAssignments" {
                    return Ok(false);
                }
                if let Value::Array(values) = reader.value()? {
                    assignments.extend(values.into_iter().filter(|assignment| {
                        let content = assignment
                            .get("varValue")
                            .and_then(|typed| typed.get("value"))
                            .and_then(|value| value.get("slotContentIdValue"))
                            .and_then(|slot| slot.get("guid"))
                            .and_then(guid_of)
                            .filter(|&guid| guid != NO_GUID);
                        content.is_none_or(|guid| self.index.find(guid).is_some())
                    }));
                }
                Ok(true)
            })?;
        }
        Ok(Value::Array(assignments))
    }

    /// The completed property definitions of a record's ancestors, nearest first.
    fn ancestor_definitions(&self, record: u32) -> crate::Result<Vec<Value<'a>>> {
        let mut chain = Vec::new();
        let mut at = self.index.find(self.index.records[record as usize].parent);
        // Records hold no parent cycles (`Error::ParentCycle`), so the chain ends.
        while let Some(ancestor) = at {
            chain.push(ancestor);
            at = self
                .index
                .find(self.index.records[ancestor as usize].parent);
        }
        // Outermost first, so each is completed from the ones above it.
        let mut completed: Vec<Value<'a>> = Vec::new();
        for &ancestor in chain.iter().rev() {
            let mut definitions = Value::Array(Vec::new());
            self.fields(
                self.index.records[ancestor as usize].span,
                |name, reader| {
                    if name != "componentPropDefs" {
                        return Ok(false);
                    }
                    let mut holder = Value::Fields(vec![(name, reader.value()?)]);
                    records::normalize(&mut holder);
                    if let Some(value) = holder.get("componentPropDefs") {
                        definitions = value.clone();
                    }
                    Ok(true)
                },
            )?;
            let outer: Vec<Value<'a>> = completed.iter().rev().cloned().collect();
            records::inherit(&mut definitions, &outer);
            completed.push(definitions);
        }
        completed.reverse();
        Ok(completed)
    }

    /// Every field of one occurrence, as the TypeScript reader's `properties`.
    pub fn of(&self, occurrence: u32) -> crate::Result<Value<'a>> {
        let expansion = self.expansion;
        let at = occurrence as usize;
        if at >= expansion.occurrences.len() {
            return Err(Error::NoOccurrence);
        }
        // Its layers, and the scales of the instances it is inside, in the order they happened.
        let mut steps: Vec<u32> =
            self.layers[self.layer_start[at] as usize..self.layer_start[at + 1] as usize].to_vec();
        let mut owner = occurrence;
        while owner != NONE {
            let o = owner as usize;
            steps.extend_from_slice(
                &self.scales[self.scale_start[o] as usize..self.scale_start[o + 1] as usize],
            );
            owner = expansion.occurrences[o].parent;
        }
        steps.sort_unstable();

        let mut replay = Replay::new();
        for step in steps {
            match expansion.steps[step as usize] {
                Step::Layer(layer) => replay.layer(self, layer)?,
                Step::Scale { factor, .. } => scale(&mut replay.props, factor),
                Step::Resize { .. } => {}
            }
        }
        let mut props = replay.props;

        // Sizes and positions come from the page-wide replay.
        let geometry = self.geometry[at];
        remove(&mut props, "size");
        remove(&mut props, "transform");
        if let Some([x, y]) = geometry.size {
            props.set(
                "size",
                Value::Fields(vec![("x", Value::Float(x)), ("y", Value::Float(y))]),
            );
        }
        if let Some(m) = geometry.transform {
            props.set(
                "transform",
                Value::Fields(vec![
                    ("m00", Value::Float(m[0])),
                    ("m01", Value::Float(m[1])),
                    ("m02", Value::Float(m[2])),
                    ("m10", Value::Float(m[3])),
                    ("m11", Value::Float(m[4])),
                    ("m12", Value::Float(m[5])),
                ]),
            );
        }
        // An instance names the component it finally expands, though the file may lack it.
        let guid = expansion.occurrences[at].expands;
        if guid != NO_GUID
            && let Some(data) = props.get_mut("symbolData")
        {
            data.set(
                "symbolID",
                Value::Fields(vec![
                    ("sessionID", Value::Uint((guid >> 32) as u32)),
                    ("localID", Value::Uint(guid as u32)),
                ]),
            );
        }
        Ok(props)
    }
}

/// A field's value, where `Properties::fields` visits it.
pub(crate) struct Visit<'r, 'a> {
    reader: &'r mut Reader<'a>,
    field: &'a Field,
    schema: &'a Schema,
}

impl<'a> Visit<'_, 'a> {
    /// Decodes the value whole.
    fn value(&mut self) -> crate::Result<Value<'a>> {
        self.reader
            .value(self.schema, self.field)
            .map_err(|_| Error::Message)
    }
}

/// A `GUID` value as one number, its session in the high half.
fn guid_of(value: &Value) -> Option<u64> {
    let part = |name| match value.get(name)? {
        Value::Uint(part) => Some(u64::from(*part)),
        _ => None,
    };
    Some(part("sessionID")? << 32 | part("localID")?)
}

fn remove(props: &mut Value, name: &str) {
    if let Value::Fields(fields) = props {
        fields.retain(|(field, _)| *field != name);
    }
}
