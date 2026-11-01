//! A face's own style names, read from its font file: the name Figma and the frontend find the
//! face by ("Book", "Condensed Bold"), and for a variable font each named instance it draws.

use read_fonts::tables::name::Name;
use read_fonts::types::{NameId, Tag};
use read_fonts::{FontRef, TableProvider};

/// The Windows platform, whose English records fonts fill most reliably.
const WINDOWS_PLATFORM: u16 = 3;
/// US English, on the Windows platform.
const ENGLISH: u16 = 0x0409;
/// The Macintosh platform, and English on it.
const MAC_PLATFORM: u16 = 1;
const MAC_ENGLISH: u16 = 0;
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

/// The string a name record holds for `id`: the Windows English record first, then the others
/// in their order, skipping any that is blank or cannot be read.
fn name_string(name: &Name, id: NameId) -> Option<String> {
    let data = name.string_data();
    let mut records: Vec<_> = name
        .name_record()
        .iter()
        .filter(|record| record.name_id() == id)
        .collect();
    // Windows English, then Mac English, then the rest, each in table order.
    records.sort_by_key(
        |record| match (record.platform_id(), record.language_id()) {
            (WINDOWS_PLATFORM, ENGLISH) => 0,
            (MAC_PLATFORM, MAC_ENGLISH) => 1,
            _ => 2,
        },
    );
    records.iter().find_map(|record| {
        let text = record.string(data).ok()?.to_string();
        let text = text.trim();
        (!text.is_empty()).then(|| text.to_string())
    })
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
    use write_fonts::tables::fvar::{
        AxisInstanceArrays, Fvar, InstanceRecord, VariationAxisRecord,
    };
    use write_fonts::tables::name::{Name, NameRecord};
    use write_fonts::types::{Fixed, NameId as WriteNameId, Tag as WriteTag};
    use write_fonts::{FontBuilder, OffsetMarker};

    #[test]
    fn compares_names_without_case_or_spaces() {
        assert_eq!(spelling("Semi Bold"), spelling("SemiBold"));
        assert_ne!(spelling("Book"), spelling("Roman"));
    }

    /// A name record: platform, encoding, language, name ID, and the string.
    type Record<'a> = (u16, u16, u16, u16, &'a str);

    const WINDOWS_ENGLISH: (u16, u16, u16) = (3, 1, 0x0409);
    const MAC_ROMAN: (u16, u16, u16) = (1, 0, 0);

    fn record(platform: (u16, u16, u16), id: u16, text: &str) -> Record<'_> {
        (platform.0, platform.1, platform.2, id, text)
    }

    /// A font of only a name table and, when `instances` has any, an fvar table with a weight
    /// axis and those instances, each by the name ID it is named under and its weight.
    fn font(records: &[Record], instances: &[(u16, i32)]) -> Vec<u8> {
        // A name table holds its records sorted, by platform, encoding, language, and ID.
        let mut records = records.to_vec();
        records.sort_by_key(|&(platform, encoding, language, id, _)| {
            (platform, encoding, language, id)
        });
        let name = Name::new(
            records
                .iter()
                .map(|&(platform, encoding, language, id, text)| {
                    NameRecord::new(
                        platform,
                        encoding,
                        language,
                        WriteNameId::new(id),
                        OffsetMarker::new(text.to_string()),
                    )
                })
                .collect(),
        );
        let mut builder = FontBuilder::new();
        builder.add_table(&name).expect("name table");
        if !instances.is_empty() {
            let axis = VariationAxisRecord::new(
                WriteTag::new(b"wght"),
                Fixed::from_i32(100),
                Fixed::from_i32(400),
                Fixed::from_i32(900),
                0,
                WriteNameId::new(255),
            );
            let instances = instances
                .iter()
                .map(|&(id, weight)| InstanceRecord {
                    subfamily_name_id: WriteNameId::new(id),
                    flags: 0,
                    coordinates: vec![Fixed::from_i32(weight)],
                    post_script_name_id: None,
                })
                .collect();
            let fvar = Fvar::new(AxisInstanceArrays::new(vec![axis], instances));
            builder.add_table(&fvar).expect("fvar table");
        }
        builder.build()
    }

    #[test]
    fn reads_the_typographic_name_over_the_legacy_one() {
        // A family of more than four faces leaves the legacy subfamily at "Regular".
        let data = font(
            &[
                record(WINDOWS_ENGLISH, 2, "Regular"),
                record(WINDOWS_ENGLISH, 17, "SemiBold"),
            ],
            &[],
        );
        assert_eq!(face_names(&data, 0).style.as_deref(), Some("SemiBold"));
        let legacy = font(&[record(WINDOWS_ENGLISH, 2, "Bold")], &[]);
        assert_eq!(face_names(&legacy, 0).style.as_deref(), Some("Bold"));
    }

    #[test]
    fn reads_another_record_when_the_windows_english_one_is_blank() {
        let data = font(
            &[
                record(WINDOWS_ENGLISH, 17, " "),
                record(MAC_ROMAN, 17, "Book"),
            ],
            &[],
        );
        assert_eq!(face_names(&data, 0).style.as_deref(), Some("Book"));
    }

    #[test]
    fn reads_the_mac_english_record_before_another_language() {
        let data = font(
            &[
                record(WINDOWS_ENGLISH, 17, ""),
                record((3, 1, 0x0407), 17, "Fett"),
                record(MAC_ROMAN, 17, "Bold"),
            ],
            &[],
        );
        assert_eq!(face_names(&data, 0).style.as_deref(), Some("Bold"));
    }

    #[test]
    fn reads_a_variable_font_s_instances_at_their_weights() {
        let data = font(
            &[
                record(WINDOWS_ENGLISH, 17, "Regular"),
                record(WINDOWS_ENGLISH, 256, "Bold"),
                record(WINDOWS_ENGLISH, 257, "Retina"),
            ],
            &[(256, 700), (257, 450)],
        );
        assert_eq!(
            face_names(&data, 0).instances,
            [
                NamedInstance {
                    name: "Bold".to_string(),
                    weight: Some(700.0)
                },
                NamedInstance {
                    name: "Retina".to_string(),
                    weight: Some(450.0)
                },
            ]
        );
    }

    #[test]
    fn reads_nothing_from_bytes_that_are_not_a_font() {
        assert_eq!(face_names(b"not a font", 0), FaceNames::default());
    }
}
