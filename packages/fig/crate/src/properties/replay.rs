//! One occurrence's fields, its layers applied in order (`occurrence/create.ts` and
//! `occurrence/claims.ts` in `packages/fig/src/instance-overrides/`).

use super::{Named, Properties, cleared, maps, records};
use crate::expand::{Bound, INHERITED, Layer, MODES, SCALED, SIZE, Source};
use crate::index::NONE;
use crate::kiwi::Span;
use crate::model::{NodeChange, NodeField, TextData};

/// Fields that change how text is shaped, so a claim changing one drops the glyphs a component
/// saved (`SHAPING_FIELDS` in `text-provenance.ts`).
const SHAPING_FIELDS: &[NodeField] = &[
    NodeField::FontSize,
    NodeField::FontName,
    NodeField::FontVariations,
    NodeField::DetachOpticalSizeFromFontSize,
    NodeField::LetterSpacing,
    NodeField::LineHeight,
    NodeField::TextCase,
    NodeField::TextAlignHorizontal,
    NodeField::TextAlignVertical,
    NodeField::TextAutoResize,
    NodeField::StyleIdForText,
    NodeField::FontVariantCommonLigatures,
    NodeField::FontVariantContextualLigatures,
];

/// An occurrence's fields as its layers are applied, with what later layers read of earlier ones.
pub struct Replay {
    pub props: NodeChange,
    /// Whether a claim has named the layer, which then keeps that name when swapped.
    has_own_name: bool,
    /// The name before the latest record layer: the one its component gave it.
    name_before: Option<String>,
    /// The latest record layer's own text, which a bound text property writes its characters into.
    own_text: Option<TextData>,
    bound: Option<Bound>,
}

impl Replay {
    pub fn new() -> Replay {
        Replay {
            props: NodeChange::default(),
            has_own_name: false,
            name_before: None,
            own_text: None,
            bound: None,
        }
    }

    pub fn layer(&mut self, properties: &Properties<'_>, layer: Layer) -> crate::Result<()> {
        match layer.source {
            Source::Bound(at) => self.bind(properties, properties.expansion.bound[at as usize]),
            Source::DefaultName(record) => {
                if self.has_own_name {
                    return Ok(());
                }
                // A replacement without a name leaves the layer none.
                self.props.name = if record == NONE {
                    self.name_before.clone()
                } else {
                    let named: Named =
                        properties.decode(properties.index.records[record as usize].span)?;
                    named.name
                };
            }
            Source::Assignments(list) => {
                self.props.component_prop_assignments = Some(properties.assignments(list)?);
            }
            source => self.entry(properties, layer, source)?,
        }
        Ok(())
    }

    /// The values the record's component properties bind replace its own
    /// (`bindSourceProperties` in `bindings/properties.ts`).
    fn bind(&mut self, properties: &Properties<'_>, bound: Bound) {
        self.bound = Some(bound);
        if let Some((visible, _)) = bound.visible {
            self.props.visible = Some(visible);
        }
        if let Some((text, _)) = bound.text {
            let (data, same) = bound_text(properties, self.own_text.clone(), text);
            // Glyphs the record saved are for its own characters.
            if !same {
                self.props.derived_text_data = None;
            }
            self.props.text_data = Some(Box::new(data));
        }
    }

    /// A record's, property layer's, or derived entry's fields over the ones before them.
    fn entry(
        &mut self,
        properties: &Properties<'_>,
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
            self.name_before = self.props.name.clone();
        }
        let mut patch = properties.layer_fields(span, &layer)?;
        // An outer owner's assignment supersedes an inner owner's explicit value.
        if let Some(bound) = self.bound.filter(|_| claim) {
            let superseded = |rank: Option<u32>| rank.is_some_and(|rank| rank < layer.rank);
            if superseded(bound.visible.map(|(_, rank)| rank)) {
                patch.visible = None;
            }
            if superseded(bound.text.map(|(_, rank)| rank)) {
                patch.text_data = None;
            }
        }
        if !matches!(source, Source::Derived(_)) {
            records::normalize(&mut patch);
        }
        if let (true, Source::Record(record)) = (own, source)
            && let Some(definitions) = patch.component_prop_defs.as_mut()
        {
            records::inherit(definitions, &properties.ancestor_definitions(record)?);
        }
        // A scaled instance restores its own distances from its record as its component
        // properties bound it: the bound text, and no glyphs saved for other characters.
        if layer.only & SCALED != 0
            && layer.only & INHERITED == 0
            && let Some((text, _)) = self.bound.and_then(|bound| bound.text)
        {
            let own = patch.text_data.take().map(|text| *text);
            let (data, same) = bound_text(properties, own, text);
            if !same {
                patch.derived_text_data = None;
            }
            patch.text_data = Some(Box::new(data));
        }
        if own {
            self.own_text = patch.text_data.as_deref().cloned();
        }
        if claim {
            if patch.is_empty() {
                return Ok(());
            }
            if cleared::clears_a_style(&patch) {
                let source = properties.record(layer.record)?;
                cleared::complete(&mut patch, &mut self.props, &source);
            }
        }
        // Variable maps merge with the ones below rather than replace them.
        let consumption = (own || claim)
            .then(|| maps::merge_consumption(&self.props, &patch))
            .flatten();
        let modes = claim
            .then(|| maps::merge_modes(&self.props, &patch))
            .flatten();
        if claim {
            invalidate_text(&mut self.props, &patch);
            self.has_own_name |= patch.name.is_some();
        }
        self.props.overlay(patch);
        if let Some(map) = consumption {
            self.props.parameter_consumption_map = Some(Box::new(map));
        }
        if let Some(map) = modes {
            self.props.variable_mode_by_set_map = Some(Box::new(map));
        }
        Ok(())
    }
}

/// A record's text with the characters a text property binds, and whether they are its own.
fn bound_text(properties: &Properties<'_>, own: Option<TextData>, text: Span) -> (TextData, bool) {
    let characters = String::from_utf8_lossy(&properties.message[text.range()]).into_owned();
    let mut data = own.unwrap_or_default();
    let same = data.characters.as_deref() == Some(characters.as_str());
    data.characters = Some(characters);
    (data, same)
}

/// Drops saved glyphs when a claim changes the text or how it is shaped and brings no glyphs of
/// its own (`invalidateInheritedTextData` in `text-provenance.ts`).
fn invalidate_text(props: &mut NodeChange, patch: &NodeChange) {
    if patch.derived_text_data.is_some() {
        return;
    }
    // The claim's text changes the layer's where laying it over the layer's changes it.
    let changed_text = patch.text_data.as_deref().is_some_and(|text| {
        let current = props.text_data.as_deref().cloned().unwrap_or_default();
        let mut changed = current.clone();
        changed.overlay(text.clone());
        changed != current
    });
    let changed_shape = SHAPING_FIELDS
        .iter()
        .any(|&field| patch.has(field) && !props.same(patch, field));
    if changed_text || changed_shape {
        props.derived_text_data = None;
    }
}
