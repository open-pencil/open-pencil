//! Named font styles the frontend uses and the weights they stand for.

/// Style names by the weight each stands for, lightest first.
const WEIGHT_STYLES: [(f32, &str); 9] = [
    (100.0, "Thin"),
    (200.0, "ExtraLight"),
    (300.0, "Light"),
    (400.0, "Regular"),
    (500.0, "Medium"),
    (600.0, "SemiBold"),
    (700.0, "Bold"),
    (800.0, "ExtraBold"),
    (900.0, "Black"),
];

/// The named weight nearest to `weight`; a tie goes to the lighter name.
pub fn named_weight(weight: f32) -> f32 {
    WEIGHT_STYLES
        .iter()
        .map(|(named, _)| *named)
        .min_by(|a, b| (a - weight).abs().total_cmp(&(b - weight).abs()))
        .unwrap_or(400.0)
}

/// The style name for a named weight, such as `SemiBold Italic` for 600 italic.
pub fn style_name(weight: f32, italic: bool) -> String {
    let named = named_weight(weight);
    let name = WEIGHT_STYLES
        .iter()
        .find(|(candidate, _)| *candidate == named)
        .map_or("Regular", |(_, name)| name);
    if italic {
        format!("{name} Italic")
    } else {
        name.to_string()
    }
}

/// The named weight and slant a style name such as `SemiBold Italic` asks for.
pub fn requested_face(style: &str) -> (f32, bool) {
    let italic = style.contains("Italic");
    let name = style.replace(" Italic", "").replace("Italic", "");
    let weight = WEIGHT_STYLES
        .iter()
        .find(|(_, candidate)| *candidate == name)
        .map_or(400.0, |(weight, _)| *weight);
    (weight, italic)
}

/// The styles a face can render: its own for a static face, and every named weight inside the
/// `wght` axis for a variable one.
pub fn face_styles(weight: f32, italic: bool, weight_axis: Option<(f32, f32)>) -> Vec<String> {
    match weight_axis {
        Some((min, max)) => WEIGHT_STYLES
            .iter()
            .filter(|(named, _)| (min..=max).contains(named))
            .map(|(named, _)| style_name(*named, italic))
            .collect(),
        None => vec![style_name(weight, italic)],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_style_names_to_weight_and_slant() {
        assert_eq!(requested_face("Regular"), (400.0, false));
        assert_eq!(requested_face("SemiBold Italic"), (600.0, true));
        assert_eq!(requested_face("Italic"), (400.0, true));
        assert_eq!(requested_face("Unknown"), (400.0, false));
    }

    #[test]
    fn names_faces_by_the_nearest_weight() {
        assert_eq!(style_name(400.0, false), "Regular");
        assert_eq!(style_name(450.0, false), "Regular");
        assert_eq!(style_name(510.0, false), "Medium");
        assert_eq!(style_name(700.0, true), "Bold Italic");
    }

    #[test]
    fn lists_every_named_weight_a_variable_face_covers() {
        assert_eq!(face_styles(510.0, false, None), ["Medium"]);
        assert_eq!(
            face_styles(400.0, true, Some((350.0, 700.0))),
            [
                "Regular Italic",
                "Medium Italic",
                "SemiBold Italic",
                "Bold Italic"
            ]
        );
    }
}
