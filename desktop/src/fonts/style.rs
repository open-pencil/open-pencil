//! The standard weight names, and how a requested style name maps to a weight and slant.

use super::names::spelling;

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

/// The named weight and slant a style name such as `SemiBold Italic` asks for, compared without
/// case or spaces; a name that is not a weight asks for 400.
pub fn requested_face(style: &str) -> (f32, bool) {
    let spelled = spelling(style);
    let italic = spelled.contains("italic");
    let name = spelled.replace("italic", "");
    let weight = WEIGHT_STYLES
        .iter()
        .find(|(_, candidate)| spelling(candidate) == name)
        .map_or(400.0, |(weight, _)| *weight);
    (weight, italic)
}

/// Whether `style` only names a weight and slant ("Bold Italic", "Semi Bold", "Italic"), so any
/// face of that weight is it; "Book" or "Condensed Bold" names one face of its own.
pub fn names_weight(style: &str) -> bool {
    let (weight, italic) = requested_face(style);
    let spelled = spelling(style);
    spelled == spelling(&style_name(weight, italic))
        || (italic && weight == 400.0 && spelled == "italic")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_style_names_to_weight_and_slant() {
        assert_eq!(requested_face("Regular"), (400.0, false));
        assert_eq!(requested_face("SemiBold Italic"), (600.0, true));
        assert_eq!(requested_face("Semi Bold Italic"), (600.0, true));
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
    fn tells_weight_names_from_names_of_their_own() {
        for name in [
            "Regular",
            "Italic",
            "Regular Italic",
            "Semi Bold",
            "ExtraBold Italic",
        ] {
            assert!(names_weight(name), "{name}");
        }
        for name in [
            "Book",
            "Roman",
            "Condensed Bold",
            "Retina",
            "Oblique",
            "Heavy",
        ] {
            assert!(!names_weight(name), "{name}");
        }
    }
}
