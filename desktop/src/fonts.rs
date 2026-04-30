use font_kit::source::SystemSource;
use serde::Serialize;
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

fn load_system_font_blocking(family: String, style: String) -> Result<Vec<u8>, String> {
    let source = SystemSource::new();
    let family_handle = source
        .select_family_by_name(&family)
        .map_err(|e| format!("Font family not found: {e}"))?;

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

    if let Some(handle) = family_handle.fonts().first() {
        if let Ok(font) = handle.load() {
            if let Some(data) = font.copy_font_data() {
                return Ok((*data).clone());
            }
        }
    }

    Err(format!("Could not load font {family} {style}"))
}

#[tauri::command]
pub async fn load_system_font(family: String, style: String) -> Result<Vec<u8>, String> {
    tauri::async_runtime::spawn_blocking(move || load_system_font_blocking(family, style))
        .await
        .map_err(|e| format!("Font load task failed: {e}"))?
}
