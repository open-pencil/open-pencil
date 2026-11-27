//! A claim that clears a style an intermediate component applied (`completeClearedStyleClaim` in
//! `packages/fig/src/instance-overrides/style/cleared.ts`).

use super::guid_of;
use crate::index::NO_GUID;
use crate::model::{NodeChange, NodeField, Number, NumberUnits, StyleId, TextCase, TextDecoration};

/// The fields each style reference gives a layer (`STYLE_GOVERNED_FIELDS`).
const GOVERNED: &[(NodeField, &[NodeField])] = &[
    (
        NodeField::StyleIdForFill,
        &[
            NodeField::FillPaints,
            NodeField::BackgroundPaints,
            NodeField::BackgroundColor,
        ],
    ),
    (NodeField::StyleIdForStrokeFill, &[NodeField::StrokePaints]),
    (
        NodeField::StyleIdForText,
        &[
            NodeField::FontName,
            NodeField::FontVersion,
            NodeField::FontSize,
            NodeField::SemanticWeight,
            NodeField::SemanticItalic,
            NodeField::LineHeight,
            NodeField::LetterSpacing,
            NodeField::TextTracking,
            NodeField::TextDecoration,
            NodeField::TextCase,
            NodeField::FontVariantCommonLigatures,
            NodeField::FontVariantContextualLigatures,
            NodeField::ToggledOnOtFeatures,
            NodeField::ToggledOffOtFeatures,
            NodeField::ParagraphSpacing,
            NodeField::ParagraphIndent,
            NodeField::ListSpacing,
        ],
    ),
    (NodeField::StyleIdForEffect, &[NodeField::Effects]),
    (NodeField::StyleIdForGrid, &[NodeField::LayoutGrids]),
];

fn reference(node: &NodeChange, field: NodeField) -> Option<&StyleId> {
    match field {
        NodeField::StyleIdForFill => node.style_id_for_fill.as_deref(),
        NodeField::StyleIdForStrokeFill => node.style_id_for_stroke_fill.as_deref(),
        NodeField::StyleIdForText => node.style_id_for_text.as_deref(),
        NodeField::StyleIdForEffect => node.style_id_for_effect.as_deref(),
        NodeField::StyleIdForGrid => node.style_id_for_grid.as_deref(),
        _ => None,
    }
}

/// Whether a style reference is the unset GUID an instance claims to clear a style with.
fn is_cleared(node: &NodeChange, field: NodeField) -> bool {
    reference(node, field)
        .and_then(|style| style.guid.as_ref())
        .is_some_and(|guid| guid_of(guid) == NO_GUID)
}

/// Whether a claim clears any style.
pub fn clears_a_style(claim: &NodeChange) -> bool {
    GOVERNED
        .iter()
        .any(|&(reference, _)| is_cleared(claim, reference))
}

/// Sets a field to what Figma reads where a record leaves it out, where it reads anything
/// (`absent` in `OVERRIDE_FIELDS`).
fn set_absent(node: &mut NodeChange, field: NodeField) -> bool {
    match field {
        NodeField::LineHeight => {
            node.line_height = Some(Number {
                value: 100.0,
                units: NumberUnits::Percent,
            });
        }
        NodeField::TextDecoration => node.text_decoration = Some(TextDecoration::None),
        NodeField::TextCase => node.text_case = Some(TextCase::Original),
        NodeField::ParagraphSpacing => node.paragraph_spacing = Some(0.0),
        NodeField::Effects => node.effects = Some(Vec::new()),
        NodeField::LayoutGrids => node.layout_grids = Some(Vec::new()),
        _ => return false,
    }
    true
}

/// A style reference and the fields it governs are one override: a claim that clears a style
/// and leaves a governed field out shows the value of the record the layer comes from, `source`,
/// so the claim is completed with it, or the layer loses the field where that record has none.
pub fn complete(claim: &mut NodeChange, props: &mut NodeChange, source: &NodeChange) {
    for &(reference, governed) in GOVERNED {
        if !is_cleared(claim, reference) {
            continue;
        }
        for &field in governed {
            if claim.has(field) {
                continue;
            }
            if source.has(field) {
                claim.copy_from(source, field);
            } else if !set_absent(claim, field) {
                props.clear(field);
            }
        }
    }
}
