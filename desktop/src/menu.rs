use serde::Deserialize;
use std::path::Path;
use tauri::menu::{
    CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, MenuItemKind, Submenu, SubmenuBuilder,
};

#[cfg(any(target_os = "macos", target_os = "windows"))]
use tauri::menu::PredefinedMenuItem;

#[derive(Deserialize)]
struct MenuGroup {
    label: String,
    items: Vec<MenuEntry>,
}

#[derive(Deserialize)]
struct MenuEntry {
    #[serde(default)]
    r#type: Option<String>,
    id: Option<String>,
    label: Option<String>,
    accelerator: Option<String>,
    #[serde(default)]
    checkbox: bool,
    #[serde(default)]
    sub: Vec<MenuEntry>,
}

fn build_submenu<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    label: &str,
    items: &[MenuEntry],
    recent_files: &[String],
) -> tauri::Result<Submenu<R>> {
    let mut builder = SubmenuBuilder::new(app, label);

    for entry in items {
        if entry.r#type.as_deref() == Some("separator") {
            builder = builder.separator();
            continue;
        }

        let label = entry.label.as_deref().unwrap_or_default();
        if entry.id.as_deref() == Some("open-recent") {
            let submenu = build_recent_files_submenu(app, label, recent_files)?;
            builder = builder.item(&submenu);
            continue;
        }
        if !entry.sub.is_empty() {
            let submenu = build_submenu(app, label, &entry.sub, recent_files)?;
            builder = builder.item(&submenu);
            continue;
        }

        // Ordinary menu accelerators emit a frontend command without preserving the
        // WebView's focused editing control. Native edit items let WebKit/WebView2
        // route copy, cut, and paste to inputs or dispatch canvas clipboard events.
        // Keep Linux on the frontend path: muda's native edit items require optional
        // X11 automation and are explicitly unsupported on Wayland.
        #[cfg(any(target_os = "macos", target_os = "windows"))]
        if let Some(id) = entry.id.as_deref() {
            let native_edit_item = match id {
                "copy" => Some(PredefinedMenuItem::copy(app, Some(label))?),
                "cut" => Some(PredefinedMenuItem::cut(app, Some(label))?),
                "paste" => Some(PredefinedMenuItem::paste(app, Some(label))?),
                _ => None,
            };
            if let Some(item) = native_edit_item {
                builder = builder.item(&item);
                continue;
            }
        }

        if entry.checkbox {
            let mut item = CheckMenuItemBuilder::new(label).checked(true);
            if let Some(id) = &entry.id {
                item = item.id(id);
            }
            if let Some(accelerator) = &entry.accelerator {
                item = item.accelerator(accelerator);
            }
            builder = builder.item(&item.build(app)?);
            continue;
        }

        let mut item = MenuItemBuilder::new(label);
        if let Some(id) = &entry.id {
            item = item.id(id);
        }
        // On Linux, muda's predefined edit commands depend on optional X11
        // automation and do not work on Wayland. Leave these accelerators to the
        // WebView instead, which preserves native input and canvas paste events.
        let webview_handles_accelerator = cfg!(target_os = "linux")
            && matches!(entry.id.as_deref(), Some("copy" | "cut" | "paste"));
        if !webview_handles_accelerator {
            if let Some(accelerator) = &entry.accelerator {
                item = item.accelerator(accelerator);
            }
        }
        builder = builder.item(&item.build(app)?);
    }

    builder.build()
}

fn recent_file_label(path: &str) -> String {
    let path = Path::new(path);
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .map(str::to_owned)
        .unwrap_or_else(|| path.as_os_str().to_string_lossy().into_owned());
    let parent = path
        .parent()
        .and_then(Path::file_name)
        .and_then(|name| name.to_str());
    parent.map_or(name.clone(), |parent| format!("{name} — {parent}"))
}

fn build_recent_files_submenu<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    label: &str,
    recent_files: &[String],
) -> tauri::Result<Submenu<R>> {
    let mut builder =
        SubmenuBuilder::with_id(app, "open-recent", label).enabled(!recent_files.is_empty());
    for (index, path) in recent_files.iter().enumerate() {
        let item = MenuItemBuilder::new(recent_file_label(path))
            .id(format!("open-recent:{index}"))
            .build(app)?;
        builder = builder.item(&item);
    }
    if !recent_files.is_empty() {
        builder = builder.separator().item(
            &MenuItemBuilder::new("Clear Menu")
                .id("clear-recent-files")
                .build(app)?,
        );
    }
    builder.build()
}

fn build_schema_menus<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    recent_files: &[String],
) -> tauri::Result<Vec<Submenu<R>>> {
    let groups: Vec<MenuGroup> = serde_json::from_str(include_str!("../generated/menu.json"))?;
    groups
        .iter()
        .map(|group| build_submenu(app, &group.label, &group.items, recent_files))
        .collect()
}

fn find_menu_item<R: tauri::Runtime>(
    items: Vec<MenuItemKind<R>>,
    id: &str,
) -> Option<MenuItemKind<R>> {
    for item in items {
        if item.id().0 == id {
            return Some(item);
        }
        if let MenuItemKind::Submenu(submenu) = &item {
            if let Ok(children) = submenu.items() {
                if let Some(found) = find_menu_item(children, id) {
                    return Some(found);
                }
            }
        }
    }
    None
}

#[tauri::command]
pub fn native_menu_checked<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    id: String,
) -> Result<bool, String> {
    let menu = app
        .menu()
        .ok_or_else(|| "Application menu is unavailable".to_string())?;
    let item = find_menu_item(menu.items().map_err(|error| error.to_string())?, &id)
        .ok_or_else(|| format!("Menu item not found: {id}"))?;
    match item {
        MenuItemKind::Check(item) => item.is_checked().map_err(|error| error.to_string()),
        _ => Err(format!("Menu item is not checkable: {id}")),
    }
}

#[tauri::command]
pub fn set_native_menu_checked<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    id: String,
    checked: bool,
) -> Result<(), String> {
    let menu = app
        .menu()
        .ok_or_else(|| "Application menu is unavailable".to_string())?;
    let item = find_menu_item(menu.items().map_err(|error| error.to_string())?, &id)
        .ok_or_else(|| format!("Menu item not found: {id}"))?;
    match item {
        MenuItemKind::Check(item) => item.set_checked(checked).map_err(|error| error.to_string()),
        _ => Err(format!("Menu item is not checkable: {id}")),
    }
}

pub fn install_app_menu<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    recent_files: &[String],
) -> tauri::Result<()> {
    #[cfg(target_os = "macos")]
    let app_menu = SubmenuBuilder::new(app, "OpenPencil")
        .item(&PredefinedMenuItem::about(
            app,
            Some("About OpenPencil"),
            None,
        )?)
        .item(
            &MenuItemBuilder::new("Check for Updates…")
                .id("check-updates")
                .build(app)?,
        )
        .separator()
        .item(&PredefinedMenuItem::services(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, None)?)
        .item(&PredefinedMenuItem::hide_others(app, None)?)
        .item(&PredefinedMenuItem::show_all(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, None)?)
        .build()?;

    let schema_menus = build_schema_menus(app, recent_files)?;
    let mut builder = MenuBuilder::new(app);

    #[cfg(target_os = "macos")]
    {
        builder = builder.item(&app_menu);
    }

    for menu in &schema_menus {
        builder = builder.item(menu);
    }

    app.set_menu(builder.build()?)?;
    Ok(())
}
