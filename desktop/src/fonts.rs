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

    // Variable fonts (e.g. SF Pro) expose every named instance at the default weight, so fall back
    // to a variable face covering the requested weight; the renderer applies the instance axes.
    let mut variable_face = None;
    for handle in family_handle.fonts() {
        if let Ok(font) = handle.load() {
            let props = font.properties();
            if props.style != style_prop {
                continue;
            }
            let Some(data) = font.copy_font_data() else {
                continue;
            };
            if (props.weight.0 - weight.0).abs() < 50.0 {
                return Ok((*data).clone());
            }
            if variable_face.is_none()
                && variable_weight_range(&data)
                    .is_some_and(|(min, max)| (min..=max).contains(&weight.0))
            {
                variable_face = Some(data);
            }
        }
    }

    variable_face
        .map(|data| (*data).clone())
        .ok_or_else(|| format!("Font face not found: {family} {style}"))
}

fn read_u16(data: &[u8], offset: usize) -> Option<u16> {
    Some(u16::from_be_bytes(
        data.get(offset..offset + 2)?.try_into().ok()?,
    ))
}

fn read_u32(data: &[u8], offset: usize) -> Option<u32> {
    Some(u32::from_be_bytes(
        data.get(offset..offset + 4)?.try_into().ok()?,
    ))
}

fn sfnt_table<'a>(data: &'a [u8], tag: &[u8; 4]) -> Option<&'a [u8]> {
    let num_tables = read_u16(data, 4)? as usize;
    (0..num_tables).find_map(|index| {
        let record = 12 + index * 16;
        if data.get(record..record + 4)? != tag {
            return None;
        }
        let offset = read_u32(data, record + 8)? as usize;
        let length = read_u32(data, record + 12)? as usize;
        data.get(offset..offset.checked_add(length)?)
    })
}

/// Returns the minimum and maximum of a variable font's `wght` axis.
fn variable_weight_range(data: &[u8]) -> Option<(f32, f32)> {
    let fvar = sfnt_table(data, b"fvar")?;
    let axes_offset = read_u16(fvar, 4)? as usize;
    let axis_count = read_u16(fvar, 8)? as usize;
    let axis_size = read_u16(fvar, 10)? as usize;
    let fixed = |offset: usize| Some(read_u32(fvar, offset)? as i32 as f32 / 65536.0);
    (0..axis_count).find_map(|index| {
        let axis = axes_offset + index * axis_size;
        if fvar.get(axis..axis + 4)? != b"wght" {
            return None;
        }
        Some((fixed(axis + 4)?, fixed(axis + 12)?))
    })
}

#[tauri::command]
pub async fn load_system_font(
    family: String,
    style: String,
) -> Result<tauri::ipc::Response, String> {
    let data =
        tauri::async_runtime::spawn_blocking(move || load_system_font_blocking(family, style))
            .await
            .map_err(|e| format!("Font load task failed: {e}"))??;
    Ok(tauri::ipc::Response::new(data))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixed(value: f32) -> [u8; 4] {
        ((value * 65536.0) as i32).to_be_bytes()
    }

    /// Builds a font with only an `fvar` table describing the given axes.
    fn font_with_axes(axes: &[(&[u8; 4], f32, f32, f32)]) -> Vec<u8> {
        let mut fvar = Vec::new();
        for value in [1u16, 0, 16, 2, axes.len() as u16, 20, 0, 0] {
            fvar.extend(value.to_be_bytes());
        }
        for (tag, min, default, max) in axes {
            fvar.extend(*tag);
            fvar.extend(fixed(*min));
            fvar.extend(fixed(*default));
            fvar.extend(fixed(*max));
            fvar.extend([0; 4]);
        }
        let mut data = Vec::new();
        data.extend(0x0001_0000u32.to_be_bytes());
        data.extend(1u16.to_be_bytes());
        data.extend([0; 6]);
        data.extend(b"fvar");
        data.extend([0; 4]);
        data.extend(28u32.to_be_bytes());
        data.extend((fvar.len() as u32).to_be_bytes());
        data.extend(fvar);
        data
    }

    #[test]
    fn reads_the_weight_axis_range() {
        let data = font_with_axes(&[(b"wdth", 30.0, 100.0, 150.0), (b"wght", 1.0, 400.0, 1000.0)]);
        assert_eq!(variable_weight_range(&data), Some((1.0, 1000.0)));
    }

    #[test]
    fn ignores_fonts_without_a_weight_axis() {
        assert_eq!(
            variable_weight_range(&font_with_axes(&[(b"wdth", 30.0, 100.0, 150.0)])),
            None
        );
        assert_eq!(variable_weight_range(&[0; 12]), None);
        assert_eq!(variable_weight_range(&[]), None);
    }
}
