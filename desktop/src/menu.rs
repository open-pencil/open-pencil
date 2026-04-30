use serde::Deserialize;
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, Submenu, SubmenuBuilder};

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

        let mut item = MenuItemBuilder::new(label);
        if let Some(id) = &entry.id {
            item = item.id(id);
        }
        if let Some(accelerator) = &entry.accelerator {
            item = item.accelerator(accelerator);
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
