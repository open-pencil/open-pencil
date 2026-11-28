//! An expanded page's field values, following how the TypeScript reader builds an occurrence's
//! properties (`packages/fig/src/instance-overrides/occurrence/create.ts`, `occurrence/claims.ts`,
//! `scale/`, `resize.ts`, and `derived-symbol-data.ts`): the expansion's steps replayed in order,
//! each layer's fields over the ones before it, as typed [`NodeChange`] records.
//!
//! Sizes and positions are replayed for the whole page at once, since an instance's resize
//! moves its layers by their own constraints and sizes. Every other field is replayed for one
//! occurrence when it is asked for.

mod cleared;
mod geometry;
mod maps;
mod records;
mod replay;
mod scale;

use serde::Deserialize;

use crate::Error;
use crate::expand::{
    Expansion, INHERITED, Layer, MODES, SCALED, SIZE, SWAPPED_PAINT, Source, Step,
};
use crate::index::{Index, NO_GUID, NONE};
use crate::kiwi::{Schema, Span, from_message, from_message_where};
use crate::model::{
    ComponentPropAssignment, ComponentPropDef, GUID, Matrix, NodeChange, NodeField, Vector,
};
pub use geometry::Geometry;
use replay::Replay;
use scale::scale;

/// A component's identity and how it sits in its parent, which an instance does not take from
/// it (`UNINHERITED_COMPONENT_FIELDS` in `instance-overrides/fields.ts`).
const UNINHERITED: &[NodeField] = &[
    NodeField::ComponentKey,
    NodeField::SourceLibraryKey,
    NodeField::PublishId,
    NodeField::PublishedVersion,
    NodeField::SharedSymbolVersion,
    NodeField::IsSymbolPublishable,
    NodeField::VariantPropSpecs,
    NodeField::ComponentPropDefs,
    NodeField::OverrideKey,
    NodeField::StackChildAlignSelf,
    NodeField::StackChildPrimaryGrow,
    NodeField::StackPositioning,
    NodeField::HorizontalConstraint,
    NodeField::VerticalConstraint,
];

/// Every field a uniform scale touches, which an instance record keeps in placed space
/// (`SCALED_FIELDS` in `scale/layout.ts`).
const SCALED_FIELDS: &[NodeField] = &[
    NodeField::StackPadding,
    NodeField::StackSpacing,
    NodeField::StackCounterSpacing,
    NodeField::StackHorizontalPadding,
    NodeField::StackVerticalPadding,
    NodeField::StackPaddingRight,
    NodeField::StackPaddingBottom,
    NodeField::StrokeWeight,
    NodeField::CornerRadius,
    NodeField::RectangleTopLeftCornerRadius,
    NodeField::RectangleTopRightCornerRadius,
    NodeField::RectangleBottomLeftCornerRadius,
    NodeField::RectangleBottomRightCornerRadius,
    NodeField::FontSize,
    NodeField::LineHeight,
    NodeField::LetterSpacing,
    NodeField::TextData,
    NodeField::DerivedTextData,
    NodeField::DashPattern,
    NodeField::Effects,
    NodeField::Size,
    NodeField::Transform,
];

/// The fields saved derived data sets (`applyDerivedEntry`).
const DERIVED_FIELDS: &[NodeField] = &[
    NodeField::DerivedTextData,
    NodeField::FontSize,
    NodeField::LineHeight,
    NodeField::LetterSpacing,
    NodeField::Size,
    NodeField::Transform,
    NodeField::FillGeometry,
    NodeField::StrokeGeometry,
    NodeField::VectorData,
];

/// An override entry's structural fields, which are not property values (`ownLayers`).
const STRUCTURAL_FIELDS: &[NodeField] = &[
    NodeField::GuidPath,
    NodeField::OverriddenSymbolId,
    NodeField::ComponentPropAssignments,
];

/// Whether a layer applies a field of its entry.
fn keeps(layer: &Layer, field: NodeField) -> bool {
    let only = layer.only;
    let kept = !(only & INHERITED != 0 && UNINHERITED.contains(&field))
        && !(only & SWAPPED_PAINT != 0
            && matches!(field, NodeField::FillPaints | NodeField::StyleIdForFill))
        && (only & SCALED == 0 || SCALED_FIELDS.contains(&field))
        && (only & SIZE == 0 || field == NodeField::Size)
        && (only & MODES == 0 || field == NodeField::VariableModeBySetMap);
    kept && match layer.source {
        Source::Override(_) => !STRUCTURAL_FIELDS.contains(&field),
        Source::Derived(_) => DERIVED_FIELDS.contains(&field),
        _ => true,
    }
}

/// A record's name, read on its own.
#[derive(Deserialize, Default)]
#[serde(default)]
struct Named {
    name: Option<String>,
}

/// A record's component property assignments, read on their own.
#[derive(Deserialize, Default)]
#[serde(default)]
struct Assignments {
    #[serde(rename = "componentPropAssignments")]
    list: Option<Vec<ComponentPropAssignment>>,
}

/// A record's component property definitions, read on their own.
#[derive(Deserialize, Default)]
#[serde(default)]
struct Definitions {
    #[serde(rename = "componentPropDefs")]
    list: Option<Vec<ComponentPropDef>>,
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

    /// Decodes the `NodeChange` at `span` into `T`, which reads only the fields it names.
    fn decode<T: Deserialize<'a>>(&self, span: Span) -> crate::Result<T> {
        from_message(
            self.schema,
            self.message,
            span.start as usize,
            self.index.ids.node_change,
        )
        .map_err(|_| Error::Message)
    }

    /// The fields of the `NodeChange` at `span` a layer applies, the rest skipped in the bytes.
    fn layer_fields(&self, span: Span, layer: &Layer) -> crate::Result<NodeChange> {
        from_message_where(
            self.schema,
            self.message,
            span.start as usize,
            self.index.ids.node_change,
            &|name| NodeField::from_name(name).is_some_and(|field| keeps(layer, field)),
        )
        .map_err(|_| Error::Message)
    }

    /// A record whole.
    fn record(&self, record: u32) -> crate::Result<NodeChange> {
        self.decode(self.index.records[record as usize].span)
    }

    /// An instance's complete assignment list, leaving out assignments of slot content the file
    /// no longer has, which fall back to their component's content.
    fn assignments(&self, list: u32) -> crate::Result<Vec<ComponentPropAssignment>> {
        let mut assignments = Vec::new();
        for &source in &self.expansion.assignment_lists[list as usize] {
            let Some(span) = self.span(source) else {
                continue;
            };
            let found: Assignments = self.decode(span)?;
            assignments.extend(found.list.into_iter().flatten().filter(|assignment| {
                let content = assignment
                    .var_value
                    .as_ref()
                    .and_then(|typed| typed.value.as_ref())
                    .and_then(|value| value.slot_content_id_value.as_ref())
                    .and_then(|slot| slot.guid.as_ref())
                    .map(guid_of)
                    .filter(|&guid| guid != NO_GUID);
                content.is_none_or(|guid| self.index.find(guid).is_some())
            }));
        }
        Ok(assignments)
    }

    /// The completed property definitions of a record's ancestors, nearest first.
    fn ancestor_definitions(&self, record: u32) -> crate::Result<Vec<Vec<ComponentPropDef>>> {
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
        let mut completed: Vec<Vec<ComponentPropDef>> = Vec::new();
        for &ancestor in chain.iter().rev() {
            let found: Definitions = self.decode(self.index.records[ancestor as usize].span)?;
            let mut definitions = found.list.unwrap_or_default();
            let outer: Vec<Vec<ComponentPropDef>> = completed.iter().rev().cloned().collect();
            records::inherit(&mut definitions, &outer);
            completed.push(definitions);
        }
        completed.reverse();
        Ok(completed)
    }

    /// Every field of one occurrence, as the TypeScript reader's `properties`.
    pub fn of(&self, occurrence: u32) -> crate::Result<NodeChange> {
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
        props.size = geometry.size.map(|[x, y]| Vector { x, y });
        props.transform = geometry
            .transform
            .map(|[m00, m01, m02, m10, m11, m12]| Matrix {
                m00,
                m01,
                m02,
                m10,
                m11,
                m12,
            });
        // An instance names the component it finally expands, though the file may lack it.
        let guid = expansion.occurrences[at].expands;
        if guid != NO_GUID
            && let Some(data) = props.symbol_data.as_mut()
        {
            data.symbol_id = Some(guid_value(guid));
        }
        Ok(props)
    }
}

/// A `GUID` as one number, its session in the high half.
fn guid_of(guid: &GUID) -> u64 {
    u64::from(guid.session_id) << 32 | u64::from(guid.local_id)
}

fn guid_value(guid: u64) -> GUID {
    GUID {
        session_id: (guid >> 32) as u32,
        local_id: guid as u32,
    }
}
