use font_kit::source::SystemSource;
use serde::Serialize;
use std::io::{Read, Seek, SeekFrom};
use std::sync::OnceLock;

#[derive(Serialize, Clone)]
pub struct FontFamily {
    family: String,
    styles: Vec<String>,
}

static FONT_CACHE: OnceLock<Vec<FontFamily>> = OnceLock::new();

fn enumerate_system_fonts() -> Vec<FontFamily> {
    let source = SystemSource::new();
    let mut families: Vec<FontFamily> = Vec::new();

    if let Ok(family_names) = source.all_families() {
        for name in &family_names {
            if let Ok(handle) = source.select_family_by_name(name) {
                let styles: Vec<String> = handle
                    .fonts()
                    .iter()
                    .filter_map(|f| {
                        f.load().ok().map(|font| {
                            let props = font.properties();
                            let mut style = match props.weight.0 as i32 {
                                0..=150 => "Thin",
                                151..=250 => "ExtraLight",
                                251..=350 => "Light",
                                351..=450 => "Regular",
                                451..=550 => "Medium",
                                551..=650 => "SemiBold",
                                651..=750 => "Bold",
                                751..=850 => "ExtraBold",
                                _ => "Black",
                            }
                            .to_string();
                            if props.style == font_kit::properties::Style::Italic {
                                style.push_str(" Italic");
                            }
                            style
                        })
                    })
                    .collect();

                if !styles.is_empty() {
                    families.push(FontFamily {
                        family: name.clone(),
                        styles,
                    });
                }
            }
        }
    }

    families.sort_by(|a, b| a.family.cmp(&b.family));
    families
}

#[tauri::command]
pub async fn list_system_fonts() -> Vec<FontFamily> {
    if let Some(cached) = FONT_CACHE.get() {
        return cached.clone();
    }

    let families = tauri::async_runtime::spawn_blocking(enumerate_system_fonts)
        .await
        .unwrap_or_default();
    let _ = FONT_CACHE.set(families.clone());
    families
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FontLoadError {
    code: FontLoadErrorCode,
    message: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
enum FontLoadErrorCode {
    NotFound,
    UnsupportedFormat,
    Failed,
}

impl FontLoadError {
    fn new(code: FontLoadErrorCode, message: String) -> Self {
        Self { code, message }
    }
}

fn load_system_font_blocking(family: String, style: String) -> Result<Vec<u8>, FontLoadError> {
    // Checked before font-kit, which would read every face of a large collection only to fail.
    #[cfg(target_os = "macos")]
    if macos::family_has_only_unsupported_outlines(&family) {
        return Err(FontLoadError::new(
            FontLoadErrorCode::UnsupportedFormat,
            format!("Font outlines are in an unsupported format: {family}"),
        ));
    }

    let source = SystemSource::new();
    let family_handle = source.select_family_by_name(&family).map_err(|e| {
        FontLoadError::new(
            FontLoadErrorCode::NotFound,
            format!("Font family not found: {e}"),
        )
    })?;

    let is_italic = style.contains("Italic");
    let weight_str = style.replace(" Italic", "");
    let weight = match weight_str.as_str() {
        "Thin" => font_kit::properties::Weight::THIN,
        "ExtraLight" => font_kit::properties::Weight::EXTRA_LIGHT,
        "Light" => font_kit::properties::Weight::LIGHT,
        "Regular" | "" => font_kit::properties::Weight::NORMAL,
        "Medium" => font_kit::properties::Weight::MEDIUM,
        "SemiBold" => font_kit::properties::Weight::SEMIBOLD,
        "Bold" => font_kit::properties::Weight::BOLD,
        "ExtraBold" => font_kit::properties::Weight::EXTRA_BOLD,
        "Black" => font_kit::properties::Weight::BLACK,
        _ => font_kit::properties::Weight::NORMAL,
    };
    let style_prop = if is_italic {
        font_kit::properties::Style::Italic
    } else {
        font_kit::properties::Style::Normal
    };

    for handle in family_handle.fonts() {
        if let Ok(font) = handle.load() {
            let props = font.properties();
            let w_diff = (props.weight.0 - weight.0).abs();
            if w_diff < 50.0 && props.style == style_prop {
                if let Some(data) = font.copy_font_data() {
                    return Ok((*data).clone());
                }
            }
        }
    }

    Err(FontLoadError::new(
        FontLoadErrorCode::NotFound,
        format!("Font face not found: {family} {style}"),
    ))
}

#[tauri::command]
pub async fn load_system_font(
    family: String,
    style: String,
) -> Result<tauri::ipc::Response, FontLoadError> {
    let data =
        tauri::async_runtime::spawn_blocking(move || load_system_font_blocking(family, style))
            .await
            .map_err(|e| {
                FontLoadError::new(
                    FontLoadErrorCode::Failed,
                    format!("Font load task failed: {e}"),
                )
            })??;
    Ok(tauri::ipc::Response::new(data))
}

const TTC_TAG: &[u8; 4] = b"ttcf";
const OUTLINE_TABLES: [&[u8; 4]; 3] = [b"glyf", b"CFF ", b"CFF2"];

fn read_array<const N: usize>(reader: &mut impl Read) -> Option<[u8; N]> {
    let mut bytes = [0; N];
    reader.read_exact(&mut bytes).ok()?;
    Some(bytes)
}

/// Returns whether every face in a font file stores outlines only in a table the renderer cannot
/// draw, such as Apple's `hvgl` (PingFang on macOS 15 and later). Reads only the table directories.
fn has_only_unsupported_outlines(reader: &mut (impl Read + Seek)) -> Option<bool> {
    let header: [u8; 12] = read_array(reader)?;
    let face_offsets = if &header[0..4] == TTC_TAG {
        let count = u32::from_be_bytes(header[8..12].try_into().ok()?);
        (0..count)
            .map(|_| read_array::<4>(reader).map(|offset| u32::from_be_bytes(offset) as u64))
            .collect::<Option<Vec<_>>>()?
    } else {
        vec![0]
    };
    for offset in face_offsets {
        reader.seek(SeekFrom::Start(offset + 4)).ok()?;
        let num_tables = u16::from_be_bytes(read_array(reader)?);
        reader.seek(SeekFrom::Current(6)).ok()?;
        let mut tags = Vec::with_capacity(num_tables as usize);
        for _ in 0..num_tables {
            let record: [u8; 16] = read_array(reader)?;
            tags.push([record[0], record[1], record[2], record[3]]);
        }
        let drawable = tags.iter().any(|tag| OUTLINE_TABLES.contains(&tag));
        if drawable || !tags.contains(b"hvgl") {
            return Some(false);
        }
    }
    Some(true)
}

#[cfg(target_os = "macos")]
mod macos {
    use core_foundation::array::CFArray;
    use core_foundation::base::{CFType, TCFType};
    use core_foundation::dictionary::CFDictionary;
    use core_foundation::string::CFString;
    use core_text::{font_collection, font_descriptor};
    use std::collections::HashSet;
    use std::fs::File;

    pub fn family_has_only_unsupported_outlines(family: &str) -> bool {
        let attributes: CFDictionary<CFString, CFType> = CFDictionary::from_CFType_pairs(&[(
            CFString::new("NSFontFamilyAttribute"),
            CFString::new(family).as_CFType(),
        )]);
        let descriptor = font_descriptor::new_from_attributes(&attributes);
        let collection =
            font_collection::new_from_descriptors(&CFArray::from_CFTypes(&[descriptor]));
        let Some(descriptors) = collection.get_descriptors() else {
            return false;
        };
        let paths: HashSet<_> = descriptors.iter().filter_map(|d| d.font_path()).collect();
        !paths.is_empty()
            && paths.iter().all(|path| {
                File::open(path)
                    .ok()
                    .and_then(|mut file| super::has_only_unsupported_outlines(&mut file))
                    .unwrap_or(false)
            })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    fn face(tags: &[&[u8; 4]]) -> Vec<u8> {
        let mut data = 0x0001_0000u32.to_be_bytes().to_vec();
        data.extend((tags.len() as u16).to_be_bytes());
        data.extend([0; 6]);
        for tag in tags {
            data.extend(*tag);
            data.extend([0; 12]);
        }
        data
    }

    fn collection(faces: &[Vec<u8>]) -> Vec<u8> {
        let mut data = TTC_TAG.to_vec();
        data.extend(0x0001_0000u32.to_be_bytes());
        data.extend((faces.len() as u32).to_be_bytes());
        let mut offset = 12 + faces.len() * 4;
        for face in faces {
            data.extend((offset as u32).to_be_bytes());
            offset += face.len();
        }
        faces.iter().for_each(|face| data.extend(face));
        data
    }

    fn check(data: Vec<u8>) -> Option<bool> {
        has_only_unsupported_outlines(&mut Cursor::new(data))
    }

    #[test]
    fn detects_collections_with_only_hvgl_outlines() {
        let hvgl = face(&[b"cmap", b"fvar", b"hvgl", b"name"]);
        assert_eq!(check(collection(&[hvgl.clone(), hvgl])), Some(true));
    }

    #[test]
    fn accepts_fonts_with_drawable_outlines() {
        assert_eq!(check(face(&[b"cmap", b"glyf", b"loca"])), Some(false));
        assert_eq!(check(face(&[b"CFF ", b"cmap"])), Some(false));
        let mixed = collection(&[face(&[b"hvgl"]), face(&[b"CFF2"])]);
        assert_eq!(check(mixed), Some(false));
    }

    #[test]
    fn ignores_truncated_data() {
        assert_eq!(check(vec![0; 6]), None);
        let mut truncated = face(&[b"hvgl", b"cmap"]);
        truncated.truncate(20);
        assert_eq!(check(truncated), None);
    }
}
