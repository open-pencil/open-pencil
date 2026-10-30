//! A face's own style names, read from its font file: the name Figma and the frontend find the
//! face by ("Book", "Condensed Bold"), and for a variable font each named instance it draws.

use read_fonts::tables::name::Name;
use read_fonts::types::{NameId, Tag};
use read_fonts::{FontRef, TableProvider};

/// The Windows platform, whose English records fonts fill most reliably.
const WINDOWS_PLATFORM: u16 = 3;
/// US English, on the Windows platform.
const ENGLISH: u16 = 0x0409;
const WEIGHT_AXIS: Tag = Tag::new(b"wght");

/// A named instance of a variable font, with the weight it is drawn at.
#[derive(Clone, Debug, PartialEq)]
pub struct NamedInstance {
    pub name: String,
    pub weight: Option<f32>,
}

/// A face's style name and, for a variable font, its named instances.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct FaceNames {
    pub style: Option<String>,
    pub instances: Vec<NamedInstance>,
}

/// The string a name record holds for `id`: the Windows English record first, then any record.
fn name_string(name: &Name, id: NameId) -> Option<String> {
    let data = name.string_data();
    let records: Vec<_> = name
        .name_record()
        .iter()
        .filter(|record| record.name_id() == id)
        .collect();
    let preferred = records
        .iter()
        .find(|record| record.platform_id() == WINDOWS_PLATFORM && record.language_id() == ENGLISH)
        .or_else(|| records.first())?;
    let text = preferred.string(data).ok()?.to_string();
    let text = text.trim();
    (!text.is_empty()).then(|| text.to_string())
}

/// The names of the face at `index` in `data`: its typographic subfamily (name ID 17), else its
/// legacy subfamily (ID 2), which families of more than four faces leave at "Regular" or "Bold".
pub fn face_names(data: &[u8], index: u32) -> FaceNames {
    let Ok(font) = FontRef::from_index(data, index) else {
        return FaceNames::default();
    };
    let Ok(name) = font.name() else {
        return FaceNames::default();
    };
    let style = name_string(&name, NameId::TYPOGRAPHIC_SUBFAMILY_NAME)
        .or_else(|| name_string(&name, NameId::SUBFAMILY_NAME));
    let instances = font
        .fvar()
        .ok()
        .and_then(|fvar| {
            let weight_axis = fvar
                .axes()
                .ok()?
                .iter()
                .position(|axis| axis.axis_tag() == WEIGHT_AXIS);
            let instances = fvar.instances().ok()?;
            Some(
                instances
                    .iter()
                    .filter_map(|instance| instance.ok())
                    .filter_map(|instance| {
                        Some(NamedInstance {
                            name: name_string(&name, instance.subfamily_name_id)?,
                            weight: weight_axis
                                .and_then(|axis| instance.coordinates.get(axis))
                                .map(|value| value.get().to_f32()),
                        })
                    })
                    .collect(),
            )
        })
        .unwrap_or_default();
    FaceNames { style, instances }
}

/// A name compared without case or spaces, so "Semi Bold" and "SemiBold" name one face.
pub fn spelling(name: &str) -> String {
    name.chars()
        .filter(|c| !c.is_whitespace())
        .flat_map(char::to_lowercase)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compares_names_without_case_or_spaces() {
        assert_eq!(spelling("Semi Bold"), spelling("SemiBold"));
        assert_ne!(spelling("Book"), spelling("Roman"));
    }

    #[test]
    fn reads_the_typographic_name_over_the_legacy_one() {
        // Its legacy subfamily (ID 2) says "Regular", as in a family of more than four faces.
        let data = include_bytes!("../../../packages/core/assets/Inter-SemiBold.ttf");
        assert_eq!(face_names(data, 0).style.as_deref(), Some("SemiBold"));
    }

    #[test]
    fn reads_a_variable_font_s_instances_at_their_weights() {
        let data = include_bytes!("../../../tests/fixtures/fonts/InterVariable-Latin.ttf");
        let instances = face_names(data, 0).instances;
        let semibold = instances
            .iter()
            .find(|instance| instance.name == "SemiBold");
        assert_eq!(semibold.and_then(|instance| instance.weight), Some(600.0));
        assert_eq!(instances.len(), 9);
    }

    #[test]
    fn reads_nothing_from_bytes_that_are_not_a_font() {
        assert_eq!(face_names(b"not a font", 0), FaceNames::default());
    }
}
