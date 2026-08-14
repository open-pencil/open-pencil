use serde::Deserialize;
use tauri::menu::{MenuBuilder, MenuItemBuilder, Submenu, SubmenuBuilder};

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
    sub: Vec<MenuEntry>,
}

fn build_submenu<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    label: &str,
    items: &[MenuEntry],
) -> tauri::Result<Submenu<R>> {
    let mut builder = SubmenuBuilder::new(app, label);

    for entry in items {
        if entry.r#type.as_deref() == Some("separator") {
            builder = builder.separator();
            continue;
        }

        let label = entry.label.as_deref().unwrap_or_default();
        if !entry.sub.is_empty() {
            let submenu = build_submenu(app, label, &entry.sub)?;
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

fn build_schema_menus<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
) -> tauri::Result<Vec<Submenu<R>>> {
    let groups: Vec<MenuGroup> = serde_json::from_str(include_str!("../generated/menu.json"))?;
    groups
        .iter()
        .map(|group| build_submenu(app, &group.label, &group.items))
        .collect()
}

pub fn install_app_menu<R: tauri::Runtime>(app: &mut tauri::App<R>) -> tauri::Result<()> {
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

    let handle = app.handle().clone();
    let schema_menus = build_schema_menus(&handle)?;
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
