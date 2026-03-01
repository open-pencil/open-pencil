use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    Emitter, Manager,
};

use font_kit::source::SystemSource;
use serde::Serialize;
use std::sync::OnceLock;

#[derive(Serialize, Clone)]
struct FontFamily {
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
fn list_system_fonts() -> Vec<FontFamily> {
    FONT_CACHE.get_or_init(enumerate_system_fonts).clone()
}

#[tauri::command]
fn load_system_font(family: String, style: String) -> Result<Vec<u8>, String> {
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

    // Fallback: return first font in family
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
fn build_fig_file(
    schema_deflated: Vec<u8>,
    kiwi_data: Vec<u8>,
    thumbnail_png: Vec<u8>,
    meta_json: String,
) -> Result<Vec<u8>, String> {
    use std::io::{Cursor, Write};

    // Zstd-compress kiwi data with content size in frame header
    let mut encoder = zstd::Encoder::new(Vec::new(), 3).map_err(|e| e.to_string())?;
    encoder
        .include_contentsize(true)
        .map_err(|e| e.to_string())?;
    encoder
        .set_pledged_src_size(Some(kiwi_data.len() as u64))
        .map_err(|e| e.to_string())?;
    encoder.write_all(&kiwi_data).map_err(|e| e.to_string())?;
    let zstd_data = encoder.finish().map_err(|e| e.to_string())?;

    // Build fig-kiwi container
    let version: u32 = 106;
    let fig_kiwi_len = 8 + 4 + 4 + schema_deflated.len() + 4 + zstd_data.len();
    let mut fig_kiwi = Vec::with_capacity(fig_kiwi_len);
    fig_kiwi.extend_from_slice(b"fig-kiwi");
    fig_kiwi.extend_from_slice(&version.to_le_bytes());
    fig_kiwi.extend_from_slice(&(schema_deflated.len() as u32).to_le_bytes());
    fig_kiwi.extend_from_slice(&schema_deflated);
    fig_kiwi.extend_from_slice(&(zstd_data.len() as u32).to_le_bytes());
    fig_kiwi.extend_from_slice(&zstd_data);

    // Deflate-compress the schema for verification it's already deflated
    // (schema_deflated is already deflated, we just pass it through)

    // Build ZIP with canvas.fig + thumbnail.png + meta.json (all STORED)
    let buf = Cursor::new(Vec::new());
    let mut zip = zip::ZipWriter::new(buf);
    let options =
        zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);

    zip.start_file("canvas.fig", options)
        .map_err(|e| e.to_string())?;
    zip.write_all(&fig_kiwi).map_err(|e| e.to_string())?;

    zip.start_file("thumbnail.png", options)
        .map_err(|e| e.to_string())?;
    zip.write_all(&thumbnail_png).map_err(|e| e.to_string())?;

    zip.start_file("meta.json", options)
        .map_err(|e| e.to_string())?;
    zip.write_all(meta_json.as_bytes())
        .map_err(|e| e.to_string())?;

    let result = zip.finish().map_err(|e| e.to_string())?;
    Ok(result.into_inner())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![build_fig_file, list_system_fonts, load_system_font])
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .on_menu_event(|app, event| {
            #[cfg(debug_assertions)]
            if event.id().0.as_str() == "dev-tools" {
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_devtools_open() {
                        window.close_devtools();
                    } else {
                        window.open_devtools();
                    }
                }
                return;
            }
            let _ = app.emit("menu-event", event.id().0.as_str());
        })
        .setup(|app| {
            #[cfg(target_os = "macos")]
            let app_menu = SubmenuBuilder::new(app, "OpenPencil")
                .item(&PredefinedMenuItem::about(
                    app,
                    Some("About OpenPencil"),
                    None,
                )?)
                .separator()
                .item(&PredefinedMenuItem::services(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::hide(app, None)?)
                .item(&PredefinedMenuItem::hide_others(app, None)?)
                .item(&PredefinedMenuItem::show_all(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::quit(app, None)?)
                .build()?;

            #[allow(unused_mut)]
            let mut file_menu_builder = SubmenuBuilder::new(app, "File")
                .item(
                    &MenuItemBuilder::new("New File")
                        .id("new")
                        .accelerator("CmdOrCtrl+N")
                        .build(app)?,
                )
                .item(
                    &MenuItemBuilder::new("Open…")
                        .id("open")
                        .accelerator("CmdOrCtrl+O")
                        .build(app)?,
                )
                .separator()
                .item(
                    &MenuItemBuilder::new("Save")
                        .id("save")
                        .accelerator("CmdOrCtrl+S")
                        .build(app)?,
                )
                .item(
                    &MenuItemBuilder::new("Save As…")
                        .id("save-as")
                        .accelerator("CmdOrCtrl+Shift+S")
                        .build(app)?,
                )
                .separator()
                .item(
                    &MenuItemBuilder::new("Export…")
                        .id("export")
                        .accelerator("CmdOrCtrl+Shift+E")
                        .build(app)?,
                )
                .separator()
                .item(
                    &MenuItemBuilder::new("Close Window")
                        .id("close")
                        .accelerator("CmdOrCtrl+W")
                        .build(app)?,
                );
            #[cfg(not(target_os = "macos"))]
            {
                file_menu_builder = file_menu_builder
                    .separator()
                    .item(&PredefinedMenuItem::quit(app, None)?);
            }
            let file_menu = file_menu_builder.build()?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .item(&PredefinedMenuItem::undo(app, None)?)
                .item(&PredefinedMenuItem::redo(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::cut(app, None)?)
                .item(&PredefinedMenuItem::copy(app, None)?)
                .item(&PredefinedMenuItem::paste(app, None)?)
                .item(
                    &MenuItemBuilder::new("Paste in Place")
                        .id("paste-in-place")
                        .accelerator("CmdOrCtrl+Shift+V")
                        .build(app)?,
                )
                .item(&PredefinedMenuItem::select_all(app, None)?)
                .separator()
                .item(
                    &MenuItemBuilder::new("Duplicate")
                        .id("duplicate")
                        .accelerator("CmdOrCtrl+D")
                        .build(app)?,
                )
                .item(
                    &MenuItemBuilder::new("Delete")
                        .id("delete")
                        .accelerator("Backspace")
                        .build(app)?,
                )
                .build()?;

            let view_menu = SubmenuBuilder::new(app, "View")
                .item(
                    &MenuItemBuilder::new("Zoom In")
                        .id("zoom-in")
                        .accelerator("CmdOrCtrl+=")
                        .build(app)?,
                )
                .item(
                    &MenuItemBuilder::new("Zoom Out")
                        .id("zoom-out")
                        .accelerator("CmdOrCtrl+-")
                        .build(app)?,
                )
                .item(
                    &MenuItemBuilder::new("Zoom to Fit")
                        .id("zoom-fit")
                        .accelerator("CmdOrCtrl+1")
                        .build(app)?,
                )
                .item(
                    &MenuItemBuilder::new("Zoom to 100%")
                        .id("zoom-100")
                        .accelerator("CmdOrCtrl+0")
                        .build(app)?,
                )
                .separator()
                .item(
                    &MenuItemBuilder::new("Toggle Rulers")
                        .id("toggle-rulers")
                        .accelerator("Shift+R")
                        .build(app)?,
                )
                .item(
                    &MenuItemBuilder::new("Toggle Grid")
                        .id("toggle-grid")
                        .accelerator("CmdOrCtrl+'")
                        .build(app)?,
                )
                .separator()
                .item(
                    &MenuItemBuilder::new("Toggle UI")
                        .id("toggle-ui")
                        .accelerator("CmdOrCtrl+\\")
                        .build(app)?,
                )
                .item(&PredefinedMenuItem::fullscreen(app, None)?)
                .separator()
                .item(
                    &MenuItemBuilder::new("Developer Tools")
                        .id("dev-tools")
                        .accelerator("CmdOrCtrl+Alt+I")
                        .build(app)?,
                )
                .build()?;

            let object_menu = SubmenuBuilder::new(app, "Object")
                .item(
                    &MenuItemBuilder::new("Group Selection")
                        .id("group")
                        .accelerator("CmdOrCtrl+G")
                        .build(app)?,
                )
                .item(
                    &MenuItemBuilder::new("Ungroup Selection")
                        .id("ungroup")
                        .accelerator("CmdOrCtrl+Shift+G")
                        .build(app)?,
                )
                .item(
                    &MenuItemBuilder::new("Frame Selection")
                        .id("frame-selection")
                        .accelerator("CmdOrCtrl+Alt+G")
                        .build(app)?,
                )
                .separator()
                .item(
                    &MenuItemBuilder::new("Bring to Front")
                        .id("bring-front")
                        .accelerator("CmdOrCtrl+]")
                        .build(app)?,
                )
                .item(
                    &MenuItemBuilder::new("Send to Back")
                        .id("send-back")
                        .accelerator("CmdOrCtrl+[")
                        .build(app)?,
                )
                .separator()
                .item(
                    &MenuItemBuilder::new("Flip Horizontal")
                        .id("flip-h")
                        .accelerator("Shift+H")
                        .build(app)?,
                )
                .item(
                    &MenuItemBuilder::new("Flip Vertical")
                        .id("flip-v")
                        .accelerator("Shift+V")
                        .build(app)?,
                )
                .build()?;

            let window_menu = SubmenuBuilder::new(app, "Window")
                .item(&PredefinedMenuItem::minimize(app, None)?)
                .item(&PredefinedMenuItem::maximize(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::close_window(app, None)?)
                .build()?;

            #[allow(unused_mut)]
            let mut help_menu_builder = SubmenuBuilder::new(app, "Help").item(
                &MenuItemBuilder::new("Keyboard Shortcuts")
                    .id("shortcuts")
                    .accelerator("CmdOrCtrl+/")
                    .build(app)?,
            );
            #[cfg(not(target_os = "macos"))]
            {
                help_menu_builder = help_menu_builder
                    .separator()
                    .item(&PredefinedMenuItem::about(
                        app,
                        Some("About OpenPencil"),
                        None,
                    )?);
            }
            let help_menu = help_menu_builder.build()?;

            let mut builder = MenuBuilder::new(app);
            #[cfg(target_os = "macos")]
            {
                builder = builder.item(&app_menu);
            }
            let menu = builder
                .items(&[
                    &file_menu,
                    &edit_menu,
                    &view_menu,
                    &object_menu,
                    &window_menu,
                    &help_menu,
                ])
                .build()?;

            app.set_menu(menu)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
