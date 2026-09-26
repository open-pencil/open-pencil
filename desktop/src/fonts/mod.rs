//! Tauri commands that list system fonts and return their data to the canvas renderer.

mod catalog;
#[cfg(target_os = "macos")]
mod macos;
mod sfnt;
mod style;

use serde::Serialize;
use std::sync::OnceLock;

#[derive(Serialize, Clone)]
pub struct FontFamily {
    family: String,
    styles: Vec<String>,
}

static FONT_CACHE: OnceLock<Vec<FontFamily>> = OnceLock::new();

fn enumerate_system_fonts() -> Vec<FontFamily> {
    let mut families: Vec<FontFamily> = catalog::families()
        .into_iter()
        .filter(|(_, faces)| !faces.is_empty())
        .map(|(family, faces)| {
            let mut styles: Vec<String> = Vec::new();
            for face in &faces {
                for name in style::face_styles(face.weight, face.italic, face.weight_axis) {
                    if !styles.contains(&name) {
                        styles.push(name);
                    }
                }
            }
            FontFamily { family, styles }
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
    let (weight, italic) = style::requested_face(&style);
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
