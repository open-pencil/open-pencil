//! A claim that clears a style an intermediate component applied (`completeClearedStyleClaim` in
//! `packages/fig/src/instance-overrides/style/cleared.ts`).

use crate::index::NO_GUID;
use crate::kiwi::Value;

use super::guid_of;

/// The fields each style reference gives a layer (`STYLE_GOVERNED_FIELDS`).
const GOVERNED: &[(&str, &[&str])] = &[
    (
        "styleIdForFill",
        &["fillPaints", "backgroundPaints", "backgroundColor"],
    ),
    ("styleIdForStrokeFill", &["strokePaints"]),
    (
        "styleIdForText",
        &[
            "fontName",
            "fontVersion",
            "fontSize",
            "semanticWeight",
            "semanticItalic",
            "lineHeight",
            "letterSpacing",
            "textTracking",
            "textDecoration",
            "textCase",
            "fontVariantCommonLigatures",
            "fontVariantContextualLigatures",
            "toggledOnOTFeatures",
            "toggledOffOTFeatures",
            "paragraphSpacing",
            "paragraphIndent",
            "listSpacing",
        ],
    ),
    ("styleIdForEffect", &["effects"]),
    ("styleIdForGrid", &["layoutGrids"]),
];

/// What Figma reads where a record leaves a governed field out (`absent` in `OVERRIDE_FIELDS`).
fn absent(field: &str) -> Option<Value<'static>> {
    Some(match field {
        "lineHeight" => Value::Fields(vec![
            ("value", Value::Float(100.0)),
            ("units", Value::Enum(Some("PERCENT"))),
        ]),
        "textDecoration" => Value::Enum(Some("NONE")),
        "textCase" => Value::Enum(Some("ORIGINAL")),
        "paragraphSpacing" => Value::Float(0.0),
        "effects" | "layoutGrids" => Value::Array(Vec::new()),
        _ => return None,
    })
}

/// A style reference to the unset GUID, which an instance claims to clear a style with.
fn is_cleared(reference: &Value) -> bool {
    reference.get("guid").and_then(guid_of) == Some(NO_GUID)
}

/// A style reference and the fields it governs are one override: a claim that clears a style
/// and leaves a governed field out shows the value of the record the layer comes from, `source`,
/// so the claim is completed with it, or the layer loses the field where that record has none.
pub fn complete<'a>(
    claim: &mut Value<'a>,
    props: &mut Value<'a>,
    source: impl Fn(&str) -> Option<Value<'a>>,
) {
    for &(reference, governed) in GOVERNED {
        if !claim.get(reference).is_some_and(is_cleared) {
            continue;
        }
        for &field in governed {
            if claim.get(field).is_some() {
                continue;
            }
            match source(field).or_else(|| absent(field)) {
                Some(value) => claim.set(field, value),
                None => super::remove(props, field),
            }
        }
    }
}
