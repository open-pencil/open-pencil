//! Distances an instance's uniform scale multiplies (`packages/fig/src/instance-overrides/scale/`).

use crate::kiwi::Value;

/// Lengths of how a layer is drawn that a uniform scale multiplies (`VISUAL_LENGTHS`).
const VISUAL_LENGTHS: &[&str] = &[
    "strokeWeight",
    "cornerRadius",
    "rectangleTopLeftCornerRadius",
    "rectangleTopRightCornerRadius",
    "rectangleBottomLeftCornerRadius",
    "rectangleBottomRightCornerRadius",
];

/// Distances a uniform scale multiplies (`LAYOUT_DISTANCES` in `scale/layout.ts`).
const LAYOUT_DISTANCES: &[&str] = &[
    "stackPadding",
    "stackSpacing",
    "stackCounterSpacing",
    "stackHorizontalPadding",
    "stackVerticalPadding",
    "stackPaddingRight",
    "stackPaddingBottom",
];

/// Multiplies the distances of one layer by an instance's uniform scale (`scale/layout.ts`),
/// leaving its size and position to the page-wide replay.
pub fn scale(props: &mut Value, factor: f64) {
    scale_text(props, factor);
    for &name in VISUAL_LENGTHS.iter().chain(LAYOUT_DISTANCES) {
        props.scale_field(name, factor);
    }
    if let Some(Value::Array(dashes)) = props.get_mut("dashPattern") {
        dashes.iter_mut().for_each(|dash| dash.scale(factor));
    }
    if let Some(Value::Array(effects)) = props.get_mut("effects") {
        for effect in effects {
            if let Some(offset) = effect.get_mut("offset") {
                offset.scale_field("x", factor);
                offset.scale_field("y", factor);
            }
            effect.scale_field("radius", factor);
            effect.scale_field("spread", factor);
        }
    }
}

/// Positional text data, not font identity or glyph outlines (`scaleTextLayout`).
fn scale_text(props: &mut Value, factor: f64) {
    props.scale_field("fontSize", factor);
    for name in ["lineHeight", "letterSpacing"] {
        if let Some(value) = props.get_mut(name)
            && value.get("units").and_then(Value::as_str) == Some("PIXELS")
        {
            value.scale_field("value", factor);
        }
    }
    if let Some(Value::Array(styles)) = props
        .get_mut("textData")
        .and_then(|text| text.get_mut("styleOverrideTable"))
    {
        styles
            .iter_mut()
            .for_each(|style| scale_text(style, factor));
    }
    let Some(derived) = props.get_mut("derivedTextData") else {
        return;
    };
    if let Some(size) = derived.get_mut("layoutSize") {
        size.scale_field("x", factor);
        size.scale_field("y", factor);
    }
    derived.scale_field("truncatedHeight", factor);
    if let Some(Value::Array(glyphs)) = derived.get_mut("glyphs") {
        for glyph in glyphs {
            if let Some(position) = glyph.get_mut("position") {
                position.scale_field("x", factor);
                position.scale_field("y", factor);
            }
            glyph.scale_field("fontSize", factor);
        }
    }
    if let Some(Value::Array(baselines)) = derived.get_mut("baselines") {
        for baseline in baselines {
            if let Some(position) = baseline.get_mut("position") {
                position.scale_field("x", factor);
                position.scale_field("y", factor);
            }
            for name in ["width", "lineHeight", "lineAscent", "lineY"] {
                baseline.scale_field(name, factor);
            }
        }
    }
}
