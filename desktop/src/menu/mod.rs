pub mod events;

use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::Mutex;
use tauri::menu::{
    CheckMenuItemBuilder, Menu, MenuBuilder, MenuItemBuilder, MenuItemKind, Submenu, SubmenuBuilder,
};

#[cfg(any(target_os = "macos", target_os = "windows"))]
use tauri::menu::PredefinedMenuItem;

#[derive(Deserialize)]
struct MenuGroup {
    label: String,
    /// A feature the frontend turns on before the whole menu shows (`set_native_menu_features`).
    feature: Option<String>,
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
    /// A feature the frontend turns on before the item shows (`set_native_menu_features`).
    feature: Option<String>,
    #[serde(default)]
    sub: Vec<MenuEntry>,
}

/// What the schema menu is built from besides the schema: recent files, enabled features, and
/// the items whose editor command is unavailable, such as Group with nothing selected.
#[derive(Default)]
pub struct NativeMenuInputs {
    pub recent_files: Vec<String>,
    pub features: Vec<String>,
    pub disabled: HashSet<String>,
}

pub struct NativeMenuState(pub Mutex<NativeMenuInputs>);

/// What one build reads: the inputs, and the check states the menu being replaced had.
struct MenuBuild<'a> {
    inputs: &'a NativeMenuInputs,
    checked: HashMap<String, bool>,
}

#[cfg(target_os = "macos")]
#[derive(Deserialize)]
struct AppMenuItem {
    label: String,
    accelerator: Option<String>,
}

/// Generated from `APP_MENU_APP_ITEMS`; placement stays here because the
/// OS-predefined items sit between these entries.
#[cfg(target_os = "macos")]
#[derive(Deserialize)]
struct AppMenuFile {
    about: AppMenuItem,
    #[serde(rename = "check-updates")]
    check_updates: AppMenuItem,
    settings: AppMenuItem,
    quit: AppMenuItem,
}

#[cfg(target_os = "macos")]
fn app_menu_file() -> tauri::Result<AppMenuFile> {
    Ok(serde_json::from_str(include_str!(
        "../../generated/app-menu.json"
    ))?)
}

/// Whether `accelerator` holds a modifier other than Shift: Ctrl, Alt, Super, or Cmd.
fn has_command_modifier(accelerator: &str) -> bool {
    let parts: Vec<&str> = accelerator.split('+').collect();
    // The last part is the key itself, which may be `+` as in `CmdOrCtrl++`.
    parts[..parts.len().saturating_sub(1)]
        .iter()
        .any(|part| !part.trim().is_empty() && !part.trim().eq_ignore_ascii_case("shift"))
}

/// The accelerator an item registers natively, if any.
///
/// GTK activates a window's accelerators before the focused widget sees the key, so on Linux a
/// menu accelerator without Ctrl, Alt, or Super takes typed characters, Backspace, and paging
/// keys away from text fields in the WebView. Those, and copy, cut, and paste, whose native
/// commands need X11 automation that Wayland lacks, are left to the frontend's shortcuts, which
/// skip text fields (`src/app/shell/keyboard/registry.ts`).
fn native_accelerator(entry: &MenuEntry) -> Option<&str> {
    let accelerator = entry.accelerator.as_deref()?;
    if cfg!(target_os = "linux") {
        let clipboard = matches!(entry.id.as_deref(), Some("copy" | "cut" | "paste"));
        if clipboard || !has_command_modifier(accelerator) {
            return None;
        }
    }
    Some(accelerator)
}

fn is_separator(entry: &MenuEntry) -> bool {
    entry.r#type.as_deref() == Some("separator")
}

/// The entries a menu shows. Items whose feature is off are left out, as is the schema's
/// Settings… on macOS, where the application menu holds it, along with the separators they
/// would leave at either end of the menu or next to each other.
fn platform_entries<'a>(items: &'a [MenuEntry], features: &[String]) -> Vec<&'a MenuEntry> {
    let mut entries: Vec<&MenuEntry> = Vec::new();
    for entry in items
        .iter()
        .filter(|entry| !(cfg!(target_os = "macos") && entry.id.as_deref() == Some("settings")))
        .filter(|entry| {
            entry
                .feature
                .as_ref()
                .is_none_or(|feature| features.contains(feature))
        })
    {
        if is_separator(entry) && entries.last().is_none_or(|last| is_separator(last)) {
            continue;
        }
        entries.push(entry);
    }
    if entries.last().is_some_and(|entry| is_separator(entry)) {
        entries.pop();
    }
    entries
}

fn item_enabled(entry: &MenuEntry, disabled: &HashSet<String>) -> bool {
    entry.id.as_ref().is_none_or(|id| !disabled.contains(id))
}

fn build_submenu<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    label: &str,
    items: &[MenuEntry],
    build: &MenuBuild,
) -> tauri::Result<Submenu<R>> {
    let mut builder = SubmenuBuilder::new(app, label);

    for entry in platform_entries(items, &build.inputs.features) {
        if is_separator(entry) {
            builder = builder.separator();
            continue;
        }

        let label = entry.label.as_deref().unwrap_or_default();
        if entry.id.as_deref() == Some("open-recent") {
            let submenu = build_recent_files_submenu(app, label, &build.inputs.recent_files)?;
            builder = builder.item(&submenu);
            continue;
        }
        if !entry.sub.is_empty() {
            let submenu = build_submenu(app, label, &entry.sub, build)?;
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
            // A rebuild keeps what the menu it replaces had checked.
            let checked = entry
                .id
                .as_ref()
                .and_then(|id| build.checked.get(id).copied())
                .unwrap_or(true);
            let mut item = CheckMenuItemBuilder::new(label)
                .checked(checked)
                .enabled(item_enabled(entry, &build.inputs.disabled));
            if let Some(id) = &entry.id {
                item = item.id(id);
            }
            if let Some(accelerator) = native_accelerator(entry) {
                item = item.accelerator(accelerator);
            }
            builder = builder.item(&item.build(app)?);
            continue;
        }

        let mut item =
            MenuItemBuilder::new(label).enabled(item_enabled(entry, &build.inputs.disabled));
        if let Some(id) = &entry.id {
            item = item.id(id);
        }
        if let Some(accelerator) = native_accelerator(entry) {
            item = item.accelerator(accelerator);
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
    build: &MenuBuild,
) -> tauri::Result<Vec<Submenu<R>>> {
    let groups: Vec<MenuGroup> = serde_json::from_str(include_str!("../../generated/menu.json"))?;
    groups
        .iter()
        .filter(|group| {
            group
                .feature
                .as_ref()
                .is_none_or(|feature| build.inputs.features.contains(feature))
        })
        .map(|group| build_submenu(app, &group.label, &group.items, build))
        .collect()
}

fn collect_checked<R: tauri::Runtime>(
    items: Vec<MenuItemKind<R>>,
    checked: &mut HashMap<String, bool>,
) {
    for item in items {
        match &item {
            MenuItemKind::Check(check) => {
                if let Ok(state) = check.is_checked() {
                    checked.insert(item.id().0.clone(), state);
                }
            }
            MenuItemKind::Submenu(submenu) => {
                if let Ok(children) = submenu.items() {
                    collect_checked(children, checked);
                }
            }
            _ => {}
        }
    }
}

fn current_checked<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> HashMap<String, bool> {
    let mut checked = HashMap::new();
    if let Some(items) = editor_menu(app).and_then(|menu| menu.items().ok()) {
        collect_checked(items, &mut checked);
    }
    checked
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

/// The menu `install_app_menu` installed: app-wide on macOS, the main window's elsewhere.
fn editor_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Option<Menu<R>> {
    #[cfg(target_os = "macos")]
    return app.menu();
    #[cfg(not(target_os = "macos"))]
    return tauri::Manager::get_webview_window(app, "main").and_then(|window| window.menu());
}

#[tauri::command]
pub fn native_menu_checked<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    id: String,
) -> Result<bool, String> {
    let menu = editor_menu(&app).ok_or_else(|| "Application menu is unavailable".to_string())?;
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
    let menu = editor_menu(&app).ok_or_else(|| "Application menu is unavailable".to_string())?;
    let item = find_menu_item(menu.items().map_err(|error| error.to_string())?, &id)
        .ok_or_else(|| format!("Menu item not found: {id}"))?;
    match item {
        MenuItemKind::Check(item) => item.set_checked(checked).map_err(|error| error.to_string()),
        _ => Err(format!("Menu item is not checkable: {id}")),
    }
}

pub fn install_app_menu<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    inputs: &NativeMenuInputs,
) -> tauri::Result<()> {
    let build = MenuBuild {
        inputs,
        checked: current_checked(app),
    };
    #[cfg(target_os = "macos")]
    let app_menu = {
        let items = app_menu_file()?;
        let mut check_updates =
            MenuItemBuilder::new(&items.check_updates.label).id("check-updates");
        if let Some(accelerator) = &items.check_updates.accelerator {
            check_updates = check_updates.accelerator(accelerator);
        }
        let mut settings = MenuItemBuilder::new(&items.settings.label).id("settings");
        if let Some(accelerator) = &items.settings.accelerator {
            settings = settings.accelerator(accelerator);
        }
        let mut quit = MenuItemBuilder::new(&items.quit.label).id("quit");
        if let Some(accelerator) = &items.quit.accelerator {
            quit = quit.accelerator(accelerator);
        }
        SubmenuBuilder::new(app, tauri::Manager::package_info(app).name.clone())
            .item(&PredefinedMenuItem::about(
                app,
                Some(&items.about.label),
                None,
            )?)
            .item(&check_updates.build(app)?)
            .separator()
            .item(&settings.build(app)?)
            .separator()
            .item(&PredefinedMenuItem::services(app, None)?)
            .separator()
            .item(&PredefinedMenuItem::hide(app, None)?)
            .item(&PredefinedMenuItem::hide_others(app, None)?)
            .item(&PredefinedMenuItem::show_all(app, None)?)
            .separator()
            .item(&quit.build(app)?)
            .build()?
    };

    let schema_menus = build_schema_menus(app, &build)?;
    let mut builder = MenuBuilder::new(app);

    #[cfg(target_os = "macos")]
    {
        builder = builder.item(&app_menu);
    }

    for menu in &schema_menus {
        builder = builder.item(menu);
    }

    let menu = builder.build()?;
    // On Windows and Linux an app-wide menu is attached to every window without its own,
    // including the Software Update window, so it goes on the editor window alone there.
    #[cfg(target_os = "macos")]
    app.set_menu(menu)?;
    #[cfg(not(target_os = "macos"))]
    if let Some(window) = tauri::Manager::get_webview_window(app, "main") {
        window.set_menu(menu)?;
    }
    Ok(())
}

/// Rebuilds the menu after one of its inputs changed.
pub fn update_app_menu<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    change: impl FnOnce(&mut NativeMenuInputs),
) -> Result<(), String> {
    let state = tauri::Manager::state::<NativeMenuState>(app);
    let mut inputs = state
        .0
        .lock()
        .map_err(|_| "Menu state is unavailable".to_string())?;
    change(&mut inputs);
    install_app_menu(app, &inputs).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_native_menu_features<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    features: Vec<String>,
) -> Result<(), String> {
    update_app_menu(&app, |inputs| inputs.features = features)
}

/// Sets the enabled state of the items among `changed`, wherever they sit in the menu.
fn apply_disabled_changes<R: tauri::Runtime>(
    items: Vec<MenuItemKind<R>>,
    disabled: &HashSet<String>,
    changed: &HashSet<String>,
) {
    for item in items {
        if let MenuItemKind::Submenu(submenu) = &item {
            if let Ok(children) = submenu.items() {
                apply_disabled_changes(children, disabled, changed);
            }
            continue;
        }
        let id = &item.id().0;
        if !changed.contains(id) {
            continue;
        }
        let enabled = !disabled.contains(id);
        match &item {
            MenuItemKind::MenuItem(menu_item) => {
                let _ = menu_item.set_enabled(enabled);
            }
            MenuItemKind::Check(check) => {
                let _ = check.set_enabled(enabled);
            }
            _ => {}
        }
    }
}

/// Greys out the items whose editor command is unavailable and enables the rest. It changes the
/// items in place, since it follows every selection change; a rebuild keeps the same state.
#[tauri::command]
pub fn set_native_menu_disabled<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    ids: Vec<String>,
) -> Result<(), String> {
    let state = tauri::Manager::state::<NativeMenuState>(&app);
    let mut inputs = state
        .0
        .lock()
        .map_err(|_| "Menu state is unavailable".to_string())?;
    let previous = std::mem::replace(&mut inputs.disabled, ids.into_iter().collect());
    let changed: HashSet<String> = previous
        .symmetric_difference(&inputs.disabled)
        .cloned()
        .collect();
    if changed.is_empty() {
        return Ok(());
    }
    if let Some(items) = editor_menu(&app).and_then(|menu| menu.items().ok()) {
        apply_disabled_changes(items, &inputs.disabled, &changed);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn groups() -> Vec<MenuGroup> {
        serde_json::from_str(include_str!("../../generated/menu.json")).expect("menu.json")
    }

    fn shown(group: &MenuGroup, features: &[String]) -> Vec<String> {
        platform_entries(&group.items, features)
            .iter()
            .map(|entry| entry.id.clone().unwrap_or_else(|| "---".into()))
            .collect()
    }

    // Home holds no document: the items that need one are gone, and so are the separators they
    // would leave at the ends of a menu or next to each other.
    #[test]
    fn leaves_no_stray_separators_without_a_document() {
        for group in groups() {
            let ids = shown(&group, &[]);
            assert_ne!(
                ids.first().map(String::as_str),
                Some("---"),
                "{}",
                group.label
            );
            assert_ne!(
                ids.last().map(String::as_str),
                Some("---"),
                "{}",
                group.label
            );
            assert!(
                !ids.windows(2)
                    .any(|pair| pair[0] == "---" && pair[1] == "---"),
                "{}: {ids:?}",
                group.label
            );
        }
    }

    #[test]
    fn hides_document_menus_until_a_document_is_in_front() {
        let document_menus: Vec<String> = groups()
            .into_iter()
            .filter(|group| group.feature.as_deref() == Some("document"))
            .map(|group| group.label)
            .collect();
        assert_eq!(document_menus, ["Object", "Text", "Arrange"]);

        let file = groups()
            .into_iter()
            .find(|group| group.label == "File")
            .expect("File menu");
        assert!(!shown(&file, &[]).contains(&"save".to_string()));
        assert!(shown(&file, &["document".to_string()]).contains(&"save".to_string()));
    }

    fn entry(id: &str, accelerator: &str) -> MenuEntry {
        MenuEntry {
            r#type: None,
            id: Some(id.to_owned()),
            label: Some(id.to_owned()),
            accelerator: Some(accelerator.to_owned()),
            checkbox: false,
            feature: None,
            sub: Vec::new(),
        }
    }

    #[test]
    fn counts_every_modifier_but_shift_as_a_command_modifier() {
        for accelerator in ["CmdOrCtrl+Z", "Ctrl+Tab", "Alt+W", "Super+K", "CmdOrCtrl++"] {
            assert!(has_command_modifier(accelerator), "{accelerator}");
        }
        for accelerator in ["N", "[", "Backspace", "PageUp", "Shift+1", "Shift+'", "+"] {
            assert!(!has_command_modifier(accelerator), "{accelerator}");
        }
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn leaves_keys_that_text_fields_type_to_the_frontend_on_linux() {
        for (id, accelerator) in [
            ("selection.delete", "Backspace"),
            ("selection.sendToBack", "["),
            ("view.zoomNextFrame", "N"),
            ("view.zoomFit", "Shift+1"),
            ("copy", "CmdOrCtrl+C"),
        ] {
            assert_eq!(native_accelerator(&entry(id, accelerator)), None, "{id}");
        }
        assert_eq!(
            native_accelerator(&entry("edit.undo", "CmdOrCtrl+Z")),
            Some("CmdOrCtrl+Z")
        );
    }

    #[cfg(not(target_os = "linux"))]
    #[test]
    fn registers_every_accelerator_off_linux() {
        assert_eq!(
            native_accelerator(&entry("view.zoomNextFrame", "N")),
            Some("N")
        );
    }
}
