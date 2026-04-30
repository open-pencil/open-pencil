use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};

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

    #[allow(unused_mut)]
    let mut file_menu_builder = SubmenuBuilder::new(app, "File")
        .item(
            &MenuItemBuilder::new("New")
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
            &MenuItemBuilder::new("Close Tab")
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

    let theme_menu = SubmenuBuilder::new(app, "Theme")
        .item(&MenuItemBuilder::new("Light").id("theme-light").build(app)?)
        .item(&MenuItemBuilder::new("Dark").id("theme-dark").build(app)?)
        .item(&MenuItemBuilder::new("Auto").id("theme-auto").build(app)?)
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
        .separator()
        .item(&theme_menu)
        .separator()
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
}
