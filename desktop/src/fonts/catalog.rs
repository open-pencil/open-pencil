//! System font discovery through fontique, which reads each face's attributes from the font
//! files the platform reports.

use fontique::{Blob, Collection, CollectionOptions, FontInfo, FontStyle, SourceCache};
use std::sync::{Mutex, OnceLock};

use super::style::named_weight;

struct Catalog {
    collection: Collection,
    cache: SourceCache,
}

static CATALOG: OnceLock<Mutex<Catalog>> = OnceLock::new();

fn with_catalog<T>(f: impl FnOnce(&mut Catalog) -> T) -> T {
    let catalog = CATALOG.get_or_init(|| {
        Mutex::new(Catalog {
            collection: Collection::new(CollectionOptions {
                shared: false,
                system_fonts: true,
            }),
            cache: SourceCache::default(),
        })
    });
    let mut catalog = catalog
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    f(&mut catalog)
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct FaceTraits {
    pub weight: f32,
    pub italic: bool,
    /// The range of a variable font's `wght` axis.
    pub weight_axis: Option<(f32, f32)>,
}

impl FaceTraits {
    fn of(font: &FontInfo) -> Self {
        Self {
            weight: font.weight().value(),
            italic: !matches!(font.style(), FontStyle::Normal),
            weight_axis: font
                .axes()
                .iter()
                .find(|axis| axis.tag == *b"wght")
                .map(|axis| (axis.min, axis.max)),
        }
    }
}

pub struct Face {
    pub data: Blob<u8>,
    pub index: u32,
}

/// Picks the face listed under the requested named weight and slant, or a variable face whose
/// weight axis covers the request. Other static weights are not substituted, so callers can report
/// the substitution.
pub fn choose_face(faces: &[FaceTraits], weight: f32, italic: bool) -> Option<usize> {
    let same_slant = |face: &&FaceTraits| face.italic == italic;
    faces
        .iter()
        .position(|face| same_slant(&face) && named_weight(face.weight) == weight)
        .or_else(|| {
            faces.iter().position(|face| {
                same_slant(&face)
                    && face
                        .weight_axis
                        .is_some_and(|(min, max)| (min..=max).contains(&weight))
            })
        })
}

/// Visible family names with the traits of each face.
pub fn families() -> Vec<(String, Vec<FaceTraits>)> {
    with_catalog(|catalog| {
        let names: Vec<String> = catalog
            .collection
            .family_names()
            .filter(|name| !name.starts_with('.'))
            .map(String::from)
            .collect();
        names
            .into_iter()
            .filter_map(|name| {
                let family = catalog.collection.family_by_name(&name)?;
                let faces = family.fonts().iter().map(FaceTraits::of).collect();
                Some((name, faces))
            })
            .collect()
    })
}

pub fn load_face(family: &str, weight: f32, italic: bool) -> Option<Face> {
    with_catalog(|catalog| {
        let family = catalog.collection.family_by_name(family)?;
        let traits: Vec<FaceTraits> = family.fonts().iter().map(FaceTraits::of).collect();
        let font = &family.fonts()[choose_face(&traits, weight, italic)?];
        Some(Face {
            data: font.load(Some(&mut catalog.cache))?,
            index: font.index(),
        })
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn face(weight: f32, italic: bool) -> FaceTraits {
        FaceTraits {
            weight,
            italic,
            weight_axis: None,
        }
    }

    #[test]
    fn chooses_the_exact_weight_and_slant() {
        let faces = [
            face(400.0, false),
            face(400.0, true),
            face(700.0, false),
            face(700.0, true),
        ];
        assert_eq!(choose_face(&faces, 700.0, true), Some(3));
        assert_eq!(choose_face(&faces, 400.0, false), Some(0));
    }

    #[test]
    fn does_not_substitute_a_nearby_static_weight() {
        assert_eq!(choose_face(&[face(400.0, false)], 700.0, false), None);
        assert_eq!(choose_face(&[face(400.0, true)], 400.0, false), None);
    }

    #[test]
    fn chooses_static_faces_by_the_style_they_are_listed_under() {
        assert_eq!(choose_face(&[face(450.0, false)], 400.0, false), Some(0));
        assert_eq!(choose_face(&[face(450.0, false)], 500.0, false), None);
        assert_eq!(choose_face(&[face(510.0, false)], 500.0, false), Some(0));
    }

    #[test]
    fn uses_a_variable_face_whose_weight_axis_covers_the_request() {
        let variable = FaceTraits {
            weight_axis: Some((1.0, 1000.0)),
            ..face(400.0, false)
        };
        let italic = FaceTraits {
            italic: true,
            ..variable
        };
        assert_eq!(choose_face(&[variable, italic], 500.0, false), Some(0));
        assert_eq!(choose_face(&[variable, italic], 700.0, true), Some(1));
        let narrow = FaceTraits {
            weight_axis: Some((300.0, 600.0)),
            ..variable
        };
        assert_eq!(choose_face(&[narrow], 700.0, false), None);
    }
}
