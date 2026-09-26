//! Tauri commands that list system fonts and return their data to the canvas renderer.

mod catalog;
#[cfg(target_os = "macos")]
mod macos;
mod sfnt;

use serde::Serialize;
use std::sync::OnceLock;

#[derive(Serialize, Clone)]
pub struct FontFamily {
    family: String,
    styles: Vec<String>,
}

static FONT_CACHE: OnceLock<Vec<FontFamily>> = OnceLock::new();

/// Style names the frontend uses, by the weight each stands for.
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

fn style_name(weight: f32, italic: bool) -> String {
    let (_, name) = WEIGHT_STYLES
        .iter()
        .min_by(|(a, _), (b, _)| (a - weight).abs().total_cmp(&(b - weight).abs()))
        .unwrap_or(&(400.0, "Regular"));
    if italic {
        format!("{name} Italic")
    } else {
        (*name).to_string()
    }
}

/// The weight and slant a frontend style name such as `SemiBold Italic` asks for.
fn requested_face(style: &str) -> (f32, bool) {
    let italic = style.contains("Italic");
    let name = style.replace(" Italic", "").replace("Italic", "");
    let weight = WEIGHT_STYLES
        .iter()
        .find(|(_, candidate)| *candidate == name)
        .map_or(400.0, |(weight, _)| *weight);
    (weight, italic)
}

fn enumerate_system_fonts() -> Vec<FontFamily> {
    let mut families: Vec<FontFamily> = catalog::families()
        .into_iter()
        .filter(|(_, faces)| !faces.is_empty())
        .map(|(family, faces)| FontFamily {
            family,
            styles: faces
                .iter()
                .map(|face| style_name(face.weight, face.italic))
                .collect(),
        })
        .collect();
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
    let (weight, italic) = requested_face(&style);
    let Some(face) = catalog::load_face(&family, weight, italic) else {
        #[cfg(target_os = "macos")]
        if macos::family_has_only_unsupported_outlines(&family) {
            return Err(FontLoadError::new(
                FontLoadErrorCode::UnsupportedFormat,
                format!("Font outlines are in an unsupported format: {family}"),
            ));
        }
        return Err(FontLoadError::new(
            FontLoadErrorCode::NotFound,
            format!("Font face not found: {family} {style}"),
        ));
    };
    sfnt::standalone_face(face.data.as_ref(), face.index).ok_or_else(|| {
        FontLoadError::new(
            FontLoadErrorCode::Failed,
            format!("Font data is malformed: {family} {style}"),
        )
    })
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
        assert_eq!(style_name(510.0, false), "Medium");
        assert_eq!(style_name(700.0, true), "Bold Italic");
    }
}
