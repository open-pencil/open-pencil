//! Distances an instance's uniform scale multiplies (`packages/fig/src/instance-overrides/scale/`).

use crate::model::{NodeChange, Number, NumberUnits, Vector};

fn times(value: &mut Option<f64>, factor: f64) {
    if let Some(value) = value {
        *value *= factor;
    }
}

fn times_vector(vector: &mut Option<Vector>, factor: f64) {
    if let Some(vector) = vector {
        vector.x *= factor;
        vector.y *= factor;
    }
}

/// A length given in pixels; one in percent or raw is not a distance.
fn times_pixels(number: &mut Option<Number>, factor: f64) {
    if let Some(number) = number
        && number.units == NumberUnits::Pixels
    {
        number.value *= factor;
    }
}

/// Multiplies the distances of one layer by an instance's uniform scale (`scale/layout.ts`),
/// leaving its size and position to the page-wide replay.
pub fn scale(props: &mut NodeChange, factor: f64) {
    scale_text(props, factor);
    for length in [
        &mut props.stroke_weight,
        &mut props.corner_radius,
        &mut props.rectangle_top_left_corner_radius,
        &mut props.rectangle_top_right_corner_radius,
        &mut props.rectangle_bottom_left_corner_radius,
        &mut props.rectangle_bottom_right_corner_radius,
        &mut props.stack_padding,
        &mut props.stack_spacing,
        &mut props.stack_counter_spacing,
        &mut props.stack_horizontal_padding,
        &mut props.stack_vertical_padding,
        &mut props.stack_padding_right,
        &mut props.stack_padding_bottom,
    ] {
        times(length, factor);
    }
    for dash in props.dash_pattern.iter_mut().flatten() {
        *dash *= factor;
    }
    for effect in props.effects.iter_mut().flatten() {
        times_vector(&mut effect.offset, factor);
        times(&mut effect.radius, factor);
        times(&mut effect.spread, factor);
    }
}

/// Positional text data, not font identity or glyph outlines (`scaleTextLayout`).
fn scale_text(props: &mut NodeChange, factor: f64) {
    times(&mut props.font_size, factor);
    times_pixels(&mut props.line_height, factor);
    times_pixels(&mut props.letter_spacing, factor);
    let ranges = props
        .text_data
        .as_deref_mut()
        .and_then(|text| text.style_override_table.as_mut());
    for range in ranges.into_iter().flatten() {
        scale_text(range, factor);
    }
    let Some(derived) = props.derived_text_data.as_deref_mut() else {
        return;
    };
    times_vector(&mut derived.layout_size, factor);
    times(&mut derived.truncated_height, factor);
    for glyph in derived.glyphs.iter_mut().flatten() {
        times_vector(&mut glyph.position, factor);
        times(&mut glyph.font_size, factor);
    }
    for baseline in derived.baselines.iter_mut().flatten() {
        times_vector(&mut baseline.position, factor);
        for length in [
            &mut baseline.width,
            &mut baseline.line_height,
            &mut baseline.line_ascent,
            &mut baseline.line_y,
        ] {
            times(length, factor);
        }
    }
}
