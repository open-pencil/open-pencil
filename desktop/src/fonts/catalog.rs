//! System font discovery through fontique, which reads each face's attributes from the font
//! files the platform reports.

use fontique::{Blob, Collection, CollectionOptions, FontInfo, FontStyle, FontWidth, SourceCache};
use std::sync::{Arc, Mutex, OnceLock};

use super::names::{face_names, spelling, FaceNames};
use super::style::{named_weight, names_weight, names_width, requested_face, style_name};

struct Catalog {
    collection: Collection,
    cache: SourceCache,
    /// What the fonts the collection lists name themselves, read once per collection.
    scan: Option<Arc<Scan>>,
    /// Counts the collections made, so a scan of one that was replaced is not kept.
    generation: u64,
}

/// The installed families and the faces listed under another family, from one read of each
/// face's names.
pub struct Scan {
    pub families: Vec<(String, Vec<ListedFace>)>,
    pub elsewhere: Vec<ListedElsewhere>,
    /// The collection the scan read, whose positions `elsewhere` holds.
    generation: u64,
}

/// A face Windows lists under a family other than the one its font names, as it lists a variable
/// font's optical sizes or a face beyond regular, bold, and italic as families of their own.
#[derive(Clone, Debug, PartialEq)]
pub struct ListedElsewhere {
    pub family: String,
    pub listed: String,
    pub position: usize,
}

static CATALOG: OnceLock<Mutex<Catalog>> = OnceLock::new();

fn system_collection() -> Collection {
    Collection::new(CollectionOptions {
        shared: false,
        system_fonts: true,
    })
}

fn with_catalog<T>(f: impl FnOnce(&mut Catalog) -> T) -> T {
    let catalog = CATALOG.get_or_init(|| {
        Mutex::new(Catalog {
            collection: system_collection(),
            cache: SourceCache::default(),
            scan: None,
            generation: 0,
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
    pub normal_width: bool,
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
            normal_width: font.width() == FontWidth::NORMAL,
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

/// A face as the frontend lists it: the name its font gives it, its weight, and its slant.
#[derive(Clone, Debug, PartialEq, serde::Serialize)]
pub struct ListedFace {
    pub style: String,
    pub weight: f32,
    pub italic: bool,
}

/// The faces a font file draws, by the names it gives them: each named instance of a variable
/// font, at its weight, else the face's own style name. A face whose font names it nothing takes
/// the standard name of its weight.
pub fn listed_faces(traits: &FaceTraits, names: &FaceNames) -> Vec<ListedFace> {
    let mut faces: Vec<ListedFace> = names
        .instances
        .iter()
        .map(|instance| ListedFace {
            style: instance.name.clone(),
            weight: instance.weight.unwrap_or(traits.weight),
            italic: traits.italic,
        })
        .collect();
    // The face the file draws by default, unless one of its instances already names it.
    let own = names
        .style
        .clone()
        .unwrap_or_else(|| style_name(traits.weight, traits.italic));
    if !faces
        .iter()
        .any(|face| spelling(&face.style) == spelling(&own))
    {
        faces.push(ListedFace {
            style: own,
            weight: traits.weight,
            italic: traits.italic,
        });
    }
    faces
}

/// Picks the face `style` names: the face of that name, or a variable face with an instance of
/// it, compared without case or spaces. A name that only names a weight falls back to that
/// weight's face, as before faces had names; any other name is that face or none.
pub fn choose_named_face(faces: &[(FaceTraits, FaceNames)], style: &str) -> Option<usize> {
    let wanted = spelling(style);
    // One pass in the order `families` lists them: the first font that names the face, by one
    // of its instances or its own name (a variable font's own face is listed beside them).
    let named = faces.iter().position(|(_, names)| {
        names
            .instances
            .iter()
            .any(|instance| spelling(&instance.name) == wanted)
            || names.style.as_deref().map(spelling) == Some(wanted.clone())
    });
    named.or_else(|| {
        if !names_weight(style) {
            return None;
        }
        let (weight, italic) = requested_face(style);
        choose_face_among(faces, has_normal_width, weight, italic)
            .or_else(|| choose_face_among(faces, |_| true, weight, italic))
    })
}

fn has_normal_width((traits, names): &(FaceTraits, FaceNames)) -> bool {
    traits.normal_width && !names.style.as_deref().is_some_and(names_width)
}

fn choose_face_among(
    faces: &[(FaceTraits, FaceNames)],
    keep: impl Fn(&(FaceTraits, FaceNames)) -> bool,
    weight: f32,
    italic: bool,
) -> Option<usize> {
    let kept: Vec<usize> = (0..faces.len()).filter(|&i| keep(&faces[i])).collect();
    let traits: Vec<FaceTraits> = kept.iter().map(|&i| faces[i].0).collect();
    choose_face(&traits, weight, italic).map(|found| kept[found])
}

/// The names a face's font gives it, read from the font file without caching its data.
fn names_of(font: &FontInfo) -> FaceNames {
    font.load(None)
        .map(|data| face_names(data.as_ref(), font.index()))
        .unwrap_or_default()
}

/// Visible families with each face they list, by the names their fonts give them.
pub fn families() -> Vec<(String, Vec<ListedFace>)> {
    scan().families.clone()
}

/// Lists the system fonts again, as installed now: the next listing or load reads them anew.
pub fn rescan() {
    with_catalog(|catalog| {
        catalog.collection = system_collection();
        catalog.cache = SourceCache::default();
        catalog.scan = None;
        catalog.generation += 1;
    });
}

/// The scan of the current collection. Each face's names are read after the catalog lock is
/// let go, so faces keep loading meanwhile.
fn scan() -> Arc<Scan> {
    let listed = with_catalog(|catalog| match &catalog.scan {
        Some(scan) => Err(scan.clone()),
        None => Ok((catalog.generation, listed_families(&mut catalog.collection))),
    });
    let (generation, listed) = match listed {
        Ok(listed) => listed,
        Err(scan) => return scan,
    };
    let faces = listed
        .into_iter()
        .map(|(name, fonts)| {
            let faces = fonts
                .iter()
                .map(|font| (FaceTraits::of(font), names_of(font)))
                .collect();
            (name, faces)
        })
        .collect();
    let scan = Arc::new(Scan {
        generation,
        ..scan_of(faces)
    });
    with_catalog(|catalog| {
        if catalog.generation != generation {
            return scan;
        }
        catalog.scan.get_or_insert(scan).clone()
    })
}

/// The families by the names their fonts give them, and the faces listed under another family,
/// in listed family name order, so a family's faces come in the same order on every launch.
pub fn scan_of(mut listed: Vec<(String, Vec<(FaceTraits, FaceNames)>)>) -> Scan {
    listed.sort_by(|a, b| a.0.cmp(&b.0));
    let elsewhere = index_listed_elsewhere(listed.clone(), |(_, names)| names.family.clone());
    Scan {
        families: families_by_own_name(listed),
        elsewhere,
        generation: 0,
    }
}

/// Faces grouped by the family their font names, as Figma lists them, else by the family the
/// platform lists them under, in the order first listed. Windows lists a family by weight,
/// width, and slant alone, so it lists each optical size of Segoe UI Variable as a family of its
/// own ("Segoe UI Variable Display"), each holding the file's every named instance; the font
/// names one family, "Segoe UI Variable", whose faces are those instances once each.
pub fn families_by_own_name(
    listed: Vec<(String, Vec<(FaceTraits, FaceNames)>)>,
) -> Vec<(String, Vec<ListedFace>)> {
    let mut families: Vec<(String, Vec<ListedFace>)> = Vec::new();
    for (listed_name, fonts) in listed {
        for (traits, names) in fonts {
            let family = names.family.clone().unwrap_or_else(|| listed_name.clone());
            let index = match families
                .iter()
                .position(|(name, _)| spelling(name) == spelling(&family))
            {
                Some(index) => index,
                None => {
                    families.push((family, Vec::new()));
                    families.len() - 1
                }
            };
            let faces = &mut families[index].1;
            for face in listed_faces(&traits, &names) {
                // An upright and an italic file may each name an instance "Bold".
                if !faces.iter().any(|listed| {
                    spelling(&listed.style) == spelling(&face.style) && listed.italic == face.italic
                }) {
                    faces.push(face);
                }
            }
        }
    }
    families
}

/// The face of `family` that `style` names, as `choose_named_face` picks it: among the faces
/// listed under `family`, else among those whose font names `family` but are listed elsewhere.
pub fn load_face(family: &str, style: &str) -> Option<Face> {
    with_catalog(|catalog| {
        let listed = catalog
            .collection
            .family_by_name(family)
            .map(|info| info.fonts().to_vec())
            .unwrap_or_default();
        named_face(catalog, &listed, style)
    })
    .or_else(|| loop {
        let scan = scan();
        // A rescan meanwhile lists other fonts at the positions the scan read: scan it again.
        let found = with_catalog(|catalog| {
            (catalog.generation == scan.generation).then(|| {
                let elsewhere = fonts_listed_elsewhere(catalog, &scan.elsewhere, family);
                named_face(catalog, &elsewhere, style)
            })
        });
        if let Some(found) = found {
            break found;
        }
    })
}

fn named_face(catalog: &mut Catalog, fonts: &[FontInfo], style: &str) -> Option<Face> {
    let faces: Vec<(FaceTraits, FaceNames)> = fonts
        .iter()
        .map(|font| (FaceTraits::of(font), names_of(font)))
        .collect();
    let font = &fonts[choose_named_face(&faces, style)?];
    Some(Face {
        data: font.load(Some(&mut catalog.cache))?,
        index: font.index(),
    })
}

fn fonts_listed_elsewhere(
    catalog: &mut Catalog,
    index: &[ListedElsewhere],
    family: &str,
) -> Vec<FontInfo> {
    listed_elsewhere_of(index, family)
        .filter_map(|face| {
            let listed = catalog.collection.family_by_name(&face.listed)?;
            listed.fonts().get(face.position).cloned()
        })
        .collect()
}

pub fn listed_elsewhere_of<'a>(
    index: &'a [ListedElsewhere],
    family: &str,
) -> impl Iterator<Item = &'a ListedElsewhere> {
    let wanted = spelling(family);
    index
        .iter()
        .filter(move |face| spelling(&face.family) == wanted)
}

fn listed_families(collection: &mut Collection) -> Vec<(String, Vec<FontInfo>)> {
    let names: Vec<String> = collection
        .family_names()
        .filter(|name| !name.starts_with('.'))
        .map(String::from)
        .collect();
    names
        .into_iter()
        .filter_map(|listed| {
            let fonts = collection.family_by_name(&listed)?.fonts().to_vec();
            Some((listed, fonts))
        })
        .collect()
}

/// The faces whose font names a family other than the one they are listed under, in family
/// name order, so the faces found for a family come in the same order on every launch.
pub fn index_listed_elsewhere<Font>(
    mut families: Vec<(String, Vec<Font>)>,
    named_family: impl Fn(&Font) -> Option<String>,
) -> Vec<ListedElsewhere> {
    families.sort_by(|a, b| a.0.cmp(&b.0));
    let mut index = Vec::new();
    for (listed, fonts) in families {
        for (position, font) in fonts.iter().enumerate() {
            if let Some(family) =
                named_family(font).filter(|family| spelling(family) != spelling(&listed))
            {
                index.push(ListedElsewhere {
                    family,
                    listed: listed.clone(),
                    position,
                });
            }
        }
    }
    index
}

#[cfg(test)]
mod tests {
    use super::super::names::NamedInstance;
    use super::*;

    fn face(weight: f32, italic: bool) -> FaceTraits {
        FaceTraits {
            weight,
            italic,
            weight_axis: None,
            normal_width: true,
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

    fn listed(family: &str, listed: &str, position: usize) -> ListedElsewhere {
        ListedElsewhere {
            family: family.to_string(),
            listed: listed.to_string(),
            position,
        }
    }

    #[test]
    fn finds_the_faces_listed_under_another_family_by_the_family_their_font_names() {
        let index = [
            listed("Acme Sans", "Acme Sans Compressed", 0),
            listed("Acme Sans", "Acme Sans Compressed", 1),
            listed("Acme Serif", "Acme Serif Display", 0),
        ];
        let found: Vec<_> = listed_elsewhere_of(&index, "acme sans").collect();
        assert_eq!(found, vec![&index[0], &index[1]]);
        assert_eq!(listed_elsewhere_of(&index, "Acme Mono").count(), 0);
    }

    #[test]
    fn indexes_faces_named_for_another_family_in_family_name_order() {
        let family_of = |named: &&str| Some(named.to_string());
        let families = |order: [usize; 2]| {
            let all = [
                ("Acme Sans Demi", vec!["Acme Sans"]),
                (
                    "Acme Sans Compressed",
                    vec!["Acme Sans", "Acme Sans Compressed"],
                ),
            ];
            order
                .iter()
                .map(|&i| (all[i].0.to_string(), all[i].1.clone()))
                .collect::<Vec<_>>()
        };
        let expected = vec![
            listed("Acme Sans", "Acme Sans Compressed", 0),
            listed("Acme Sans", "Acme Sans Demi", 0),
        ];
        assert_eq!(
            index_listed_elsewhere(families([0, 1]), family_of),
            expected
        );
        assert_eq!(
            index_listed_elsewhere(families([1, 0]), family_of),
            expected
        );
    }

    fn named(style: &str) -> FaceNames {
        FaceNames {
            family: None,
            style: Some(style.to_string()),
            instances: Vec::new(),
        }
    }

    #[test]
    fn chooses_a_static_face_by_its_own_name() {
        let faces = [
            (face(400.0, false), named("Roman")),
            (face(350.0, false), named("Book")),
            (face(700.0, false), named("Condensed Bold")),
            (face(700.0, false), named("Bold")),
        ];
        assert_eq!(choose_named_face(&faces, "Book"), Some(1));
        assert_eq!(choose_named_face(&faces, "condensed bold"), Some(2));
        // A weight name falls back to that weight's face; another name is that face or none.
        assert_eq!(choose_named_face(&faces, "Regular"), Some(0));
        assert_eq!(choose_named_face(&faces, "Heavy"), None);
    }

    #[test]
    fn chooses_the_normal_width_face_for_a_weight_only_style() {
        let faces = [
            (face(600.0, false), named("Compressed Demi")),
            (face(600.0, false), named("Condensed Demi")),
            (face(600.0, false), named("Demi")),
            (face(600.0, false), named("Wide Demi")),
        ];
        assert_eq!(choose_named_face(&faces, "SemiBold"), Some(2));
        let only_width = [
            (face(400.0, false), named("Book")),
            (face(600.0, false), named("Condensed Demi")),
        ];
        assert_eq!(choose_named_face(&only_width, "SemiBold"), Some(1));
        let narrow = FaceTraits {
            normal_width: false,
            ..face(600.0, false)
        };
        let by_width_class = [
            (narrow, named("Demi")),
            (face(600.0, false), named("Text Demi")),
        ];
        assert_eq!(choose_named_face(&by_width_class, "SemiBold"), Some(1));
    }

    #[test]
    fn chooses_a_variable_face_by_one_of_its_instances() {
        let variable = FaceNames {
            family: None,
            style: Some("Regular".to_string()),
            instances: vec![
                NamedInstance {
                    name: "Bold".to_string(),
                    weight: Some(700.0),
                },
                NamedInstance {
                    name: "Condensed Bold".to_string(),
                    weight: Some(700.0),
                },
            ],
        };
        let faces = [(face(400.0, false), variable)];
        assert_eq!(choose_named_face(&faces, "Condensed Bold"), Some(0));
        assert_eq!(choose_named_face(&faces, "Condensed Black"), None);
    }

    #[test]
    fn loads_a_variable_face_by_its_own_name_beside_its_instances() {
        let variable = FaceNames {
            family: None,
            style: Some("Text".to_string()),
            instances: vec![NamedInstance {
                name: "Display".to_string(),
                weight: Some(400.0),
            }],
        };
        let faces = [(face(400.0, false), variable)];
        assert_eq!(choose_named_face(&faces, "Text"), Some(0));
        assert_eq!(choose_named_face(&faces, "Display"), Some(0));
    }

    #[test]
    fn loads_the_font_the_listing_takes_a_name_from() {
        // An earlier variable font lists "Display" as an instance; a later font is named so.
        let variable = FaceNames {
            family: None,
            style: Some("Text".to_string()),
            instances: vec![NamedInstance {
                name: "Display".to_string(),
                weight: Some(700.0),
            }],
        };
        let faces = [
            (face(400.0, false), variable),
            (face(700.0, false), named("Display")),
        ];
        assert_eq!(choose_named_face(&faces, "Display"), Some(0));
    }

    #[test]
    fn keeps_a_variable_face_s_default_when_no_instance_names_it() {
        let variable = FaceNames {
            family: None,
            style: Some("Text".to_string()),
            instances: vec![NamedInstance {
                name: "Display".to_string(),
                weight: Some(400.0),
            }],
        };
        let styles: Vec<String> = listed_faces(&face(400.0, false), &variable)
            .into_iter()
            .map(|listed| listed.style)
            .collect();
        assert_eq!(styles, ["Display", "Text"]);
    }

    #[test]
    fn one_scan_lists_families_and_the_faces_listed_under_another_family() {
        let names = |family: Option<&str>, style: &str| FaceNames {
            family: family.map(String::from),
            ..named(style)
        };
        let scan = scan_of(vec![
            (
                "Sitka Text".to_string(),
                vec![(face(400.0, false), names(Some("Sitka"), "Text"))],
            ),
            (
                "Sitka Banner".to_string(),
                vec![(face(400.0, false), names(Some("Sitka"), "Banner"))],
            ),
            (
                "Arial".to_string(),
                vec![(face(400.0, false), names(Some("Arial"), "Regular"))],
            ),
        ]);
        let families: Vec<(&str, Vec<&str>)> = scan
            .families
            .iter()
            .map(|(family, faces)| {
                (
                    family.as_str(),
                    faces.iter().map(|face| face.style.as_str()).collect(),
                )
            })
            .collect();
        assert_eq!(
            families,
            vec![
                ("Arial", vec!["Regular"]),
                ("Sitka", vec!["Banner", "Text"])
            ]
        );
        assert_eq!(
            scan.elsewhere,
            vec![
                listed("Sitka", "Sitka Banner", 0),
                listed("Sitka", "Sitka Text", 0)
            ]
        );
    }

    #[test]
    fn lists_faces_under_the_family_their_font_names_once_each() {
        let variable = |listed: &str| {
            let names = FaceNames {
                family: Some("Segoe UI Variable".to_string()),
                style: Some("Regular".to_string()),
                instances: ["Bold Display", "Regular", "Light Small"]
                    .iter()
                    .map(|name| NamedInstance {
                        name: name.to_string(),
                        weight: None,
                    })
                    .collect(),
            };
            (listed.to_string(), vec![(face(400.0, false), names)])
        };
        let unnamed = (
            "Plain Sans".to_string(),
            vec![(face(400.0, false), named("Book"))],
        );
        let families = families_by_own_name(vec![
            variable("Segoe UI Variable Display"),
            unnamed,
            variable("Segoe UI Variable Text"),
        ]);
        let listed: Vec<(String, Vec<String>)> = families
            .into_iter()
            .map(|(family, faces)| (family, faces.into_iter().map(|face| face.style).collect()))
            .collect();
        assert_eq!(
            listed,
            vec![
                (
                    "Segoe UI Variable".to_string(),
                    vec![
                        "Bold Display".to_string(),
                        "Regular".to_string(),
                        "Light Small".to_string()
                    ]
                ),
                ("Plain Sans".to_string(), vec!["Book".to_string()]),
            ]
        );
    }

    #[test]
    fn lists_a_variable_face_by_its_instances_and_a_static_one_by_its_name() {
        let variable = FaceNames {
            family: None,
            style: Some("Retina".to_string()),
            instances: vec![NamedInstance {
                name: "Retina".to_string(),
                weight: Some(450.0),
            }],
        };
        assert_eq!(
            listed_faces(&face(400.0, false), &variable),
            [ListedFace {
                style: "Retina".to_string(),
                weight: 450.0,
                italic: false
            }]
        );
        assert_eq!(
            listed_faces(&face(350.0, false), &named("Book")),
            [ListedFace {
                style: "Book".to_string(),
                weight: 350.0,
                italic: false
            }]
        );
        assert_eq!(
            listed_faces(&face(700.0, true), &FaceNames::default()),
            [ListedFace {
                style: "Bold Italic".to_string(),
                weight: 700.0,
                italic: true
            }]
        );
    }
}
