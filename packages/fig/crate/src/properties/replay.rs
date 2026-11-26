//! One occurrence's fields, its layers applied in order (`occurrence/create.ts` and
//! `occurrence/claims.ts` in `packages/fig/src/instance-overrides/`).

use super::{Properties, cleared, keeps, maps, records, remove, styles};
use crate::expand::{Bound, Layer, MODES, SCALED, SIZE, Source};
use crate::index::NONE;
use crate::kiwi::Value;

/// An occurrence's fields as its layers are applied, with what later layers read of earlier ones.
pub struct Replay<'a> {
    pub props: Value<'a>,
    /// Whether a claim has named the layer, which then keeps that name when swapped.
    has_own_name: bool,
    /// The name before the latest record layer: the one its component gave it.
    name_before: Option<Value<'a>>,
    /// The latest record layer's own text, which a bound text property writes its characters into.
    own_text: Option<Value<'a>>,
    bound: Option<Bound>,
}

impl<'a> Replay<'a> {
    pub fn new() -> Replay<'a> {
        Replay {
            props: Value::Fields(Vec::new()),
            has_own_name: false,
            name_before: None,
            own_text: None,
            bound: None,
        }
    }

    pub fn layer(&mut self, properties: &Properties<'a>, layer: Layer) -> crate::Result<()> {
        match layer.source {
            Source::Bound(at) => self.bind(properties, properties.expansion.bound[at as usize]),
            Source::DefaultName(record) => {
                if self.has_own_name {
                    return Ok(());
                }
                let name = if record == NONE {
                    self.name_before.clone()
                } else {
                    properties.record_field(record, "name")?
                };
                match name {
                    Some(name) => self.props.set("name", name),
                    // A replacement without a name leaves the layer none.
                    None => remove(&mut self.props, "name"),
                }
            }
            Source::Assignments(list) => {
                let assignments = properties.assignments(list)?;
                self.props.set("componentPropAssignments", assignments);
            }
            source => self.entry(properties, layer, source)?,
        }
        Ok(())
    }

    /// The values the record's component properties bind replace its own
    /// (`bindSourceProperties` in `bindings/properties.ts`).
    fn bind(&mut self, properties: &Properties<'a>, bound: Bound) {
        self.bound = Some(bound);
        if let Some((visible, _)) = bound.visible {
            self.props.set("visible", Value::Bool(visible));
        }
        if let Some((text, _)) = bound.text {
            let characters = String::from_utf8_lossy(&properties.message[text.range()]);
            let mut data = self.own_text.clone().unwrap_or(Value::Fields(Vec::new()));
            // Glyphs the record saved are for its own characters.
            if data.get("characters").and_then(Value::as_str) != Some(&characters) {
                remove(&mut self.props, "derivedTextData");
            }
            data.set("characters", Value::String(characters));
            self.props.set("textData", data);
        }
    }

    /// A record's, property layer's, or derived entry's fields over the ones before them.
    fn entry(
        &mut self,
        properties: &Properties<'a>,
        layer: Layer,
        source: Source,
    ) -> crate::Result<()> {
        let Some(span) = properties.span(source) else {
            return Ok(());
        };
        // A property layer, or an instance's claim on its own modes, is a claim.
        let claim = matches!(source, Source::Override(_)) || layer.only & MODES != 0;
        let own = matches!(source, Source::Record(_)) && layer.only & (SCALED | SIZE | MODES) == 0;
        if own {
            self.name_before = self.props.get("name").cloned();
        }
        let bound = self.bound.filter(|_| claim);
        let mut patch = Value::Fields(Vec::new());
        properties.fields(span, |name, reader| {
            if !keeps(&layer, name) || bound.is_some_and(|bound| supersedes(bound, &layer, name)) {
                return Ok(false);
            }
            patch.set(name, reader.value()?);
            Ok(true)
        })?;
        properties.prepare(&mut patch, matches!(source, Source::Derived(_)), true);
        if let (true, Source::Record(record)) = (own, source)
            && let Some(definitions) = patch.get_mut("componentPropDefs")
        {
            records::inherit(definitions, &properties.ancestor_definitions(record)?);
        }
        if own {
            self.own_text = patch.get("textData").cloned();
        }
        if claim {
            styles::yield_to_text_style(&mut self.props, &mut patch, |reference| {
                properties.style(reference)
            });
            if matches!(&patch, Value::Fields(fields) if fields.is_empty()) {
                return Ok(());
            }
            // The record the claim lands on, as the reader prepares it.
            let source = properties.prepared(layer.record);
            cleared::complete(&mut patch, &mut self.props, |field| {
                source
                    .as_ref()
                    .and_then(|record| record.get(field))
                    .cloned()
            });
        }
        // Variable maps merge with the ones below rather than replace them.
        let consumption = (own || claim)
            .then(|| maps::merge_consumption(&self.props, &patch))
            .flatten();
        let modes = claim
            .then(|| maps::merge_modes(&self.props, &patch))
            .flatten();
        let Value::Fields(fields) = patch else {
            return Ok(());
        };
        if claim {
            invalidate_text(&mut self.props, &fields);
            self.has_own_name |= fields.iter().any(|(name, _)| *name == "name");
        }
        for (name, value) in fields {
            match value {
                Value::Undefined => remove(&mut self.props, name),
                value => self.props.set(name, value),
            }
        }
        if let Some(map) = consumption {
            self.props.set("parameterConsumptionMap", map);
        }
        if let Some(map) = modes {
            self.props.set("variableModeBySetMap", map);
        }
        Ok(())
    }
}

/// Whether an outer owner's assignment supersedes a claim's explicit value for a field: the
/// assigning owner is further out than the claiming one.
fn supersedes(bound: Bound, layer: &Layer, name: &str) -> bool {
    let rank = match name {
        "visible" => bound.visible.map(|(_, rank)| rank),
        "textData" => bound.text.map(|(_, rank)| rank),
        _ => None,
    };
    rank.is_some_and(|rank| rank < layer.rank)
}

/// Fields that change how text is shaped, so a claim changing one drops the glyphs a component
/// saved (`SHAPING_FIELDS` in `text-provenance.ts`).
const SHAPING_FIELDS: &[&str] = &[
    "fontSize",
    "fontName",
    "fontVariations",
    "detachOpticalSizeFromFontSize",
    "letterSpacing",
    "lineHeight",
    "textCase",
    "textAlignHorizontal",
    "textAlignVertical",
    "textAutoResize",
    "styleIdForText",
    "fontVariantCommonLigatures",
    "fontVariantContextualLigatures",
];

/// Drops saved glyphs when a claim changes the text or how it is shaped and brings no glyphs of
/// its own (`invalidateInheritedTextData` in `text-provenance.ts`).
fn invalidate_text(props: &mut Value, patch: &[(&str, Value)]) {
    let set = |name: &str| {
        patch
            .iter()
            .find(|(field, _)| *field == name)
            .map(|(_, value)| value)
    };
    if set("derivedTextData").is_some() {
        return;
    }
    let current = props.get("textData");
    let changed_text = set("textData").is_some_and(|text| match text {
        Value::Fields(fields) => fields
            .iter()
            .any(|(field, value)| current.and_then(|current| current.get(field)) != Some(value)),
        _ => false,
    });
    let changed_shape = SHAPING_FIELDS.iter().any(|&name| {
        // A field set to nothing is the same as one left out.
        set(name).is_some_and(|value| props.get(name).unwrap_or(&Value::Undefined) != value)
    });
    if changed_text || changed_shape {
        remove(props, "derivedTextData");
    }
}
