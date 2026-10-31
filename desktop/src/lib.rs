mod agents;
mod credentials;
mod files;
mod fonts;
mod icons;
mod launch;
mod menu;
mod network;
mod system;

use credentials::{
    credential_access_paused, credential_read, credential_remove, credential_retry_access,
    credential_status, credential_store_availability, credential_write,
};
use fonts::{list_system_fonts, load_system_font};
use launch::args;
use menu::events::handle_menu_event;
use menu::{
    install_app_menu, native_menu_checked, set_native_menu_checked, set_native_menu_features,
    NativeMenuInputs, NativeMenuState,
};
use network::http::{cancel_http_request, proxy_http_request, ProxyHttpRequests};
use std::sync::Mutex;
#[cfg(target_os = "macos")]
use system::window::show_main_window;
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = fix_path_env::fix();
    agents::path::augment_process_path();

    let mut builder = tauri::Builder::default();

    #[cfg(feature = "native-test")]
    {
        builder = builder
            .manage(system::opener::OpenedExternalUrls::default())
            .plugin(tauri_plugin_wdio_webdriver::init());
    }

    #[cfg(all(
        any(target_os = "macos", windows, target_os = "linux"),
        not(feature = "native-test")
    ))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            launch::queue_deep_links(app, args::deep_links_from_args(&args));
            launch::queue_open_paths(
                app,
                args::open_paths_from_args(args, std::path::Path::new(&cwd)),
            );
        }));
    }

    builder = builder.plugin(tauri_plugin_deep_link::init());

    builder
        .manage(launch::PendingOpen::default())
        .manage(ProxyHttpRequests::default())
        .manage(network::oauth::ChatGPTOAuthLoopback::default())
        .manage(launch::PendingRooms::default())
        .manage(NativeMenuState(Mutex::new(NativeMenuInputs::default())))
        .manage(launch::PendingCloudLinks::default())
        .invoke_handler(tauri::generate_handler![
            agents::lookup::agent_lookup,
            agents::lookup::agent_workspace,
            files::fig::build_fig_file,
            network::oauth::chatgpt_oauth_listen,
            network::oauth::chatgpt_oauth_wait,
            network::oauth::chatgpt_oauth_cancel,
            credential_read,
            credential_access_paused,
            credential_retry_access,
            credential_remove,
            credential_status,
            credential_store_availability,
            credential_write,
            agents::mcp::mcp_lookup,
            agents::skills::skill_folders,
            agents::skills::project_skill_folders,
            agents::skills::skill_folder_file,
            #[cfg(feature = "native-test")]
            launch::native_test_open_deep_link,
            system::opener::open_external_url,
            #[cfg(feature = "native-test")]
            system::opener::take_native_test_opened_urls,
            launch::paths::path_matches_suffix,
            list_system_fonts,
            load_system_font,
            icons::sf_symbols_catalogue,
            icons::sf_symbols_render,
            proxy_http_request,
            cancel_http_request,
            files::recent::set_recent_files,
            set_native_menu_features,
            native_menu_checked,
            set_native_menu_checked,
            launch::take_pending_open,
            launch::take_pending_rooms,
            system::env::sharing_disabled_by_env,
            launch::take_pending_cloud_links,
            system::env::webview_version
        ])
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .on_menu_event(|app, event| {
            handle_menu_event(app, event.id().0.as_str());
        })
        .setup(|app| {
            // The main window is built here rather than from the config alone, so that pages it
            // opens with `window.open` reach the system browser.
            let main = app
                .config()
                .app
                .windows
                .first()
                .cloned()
                .ok_or("the main window is not configured")?;
            tauri::WebviewWindowBuilder::from_config(app.handle(), &main)?
                .on_new_window(system::opener::open_new_window_externally(
                    app.handle().clone(),
                ))
                .build()?;

            launch::queue_open_paths(app.handle(), args::startup_open_paths());

            use tauri_plugin_deep_link::DeepLinkExt;
            // On macOS the plugin turns `RunEvent::Opened` into this callback, so every
            // link that arrives while the app runs is handled here; the cold-start link
            // arrives before this closure and is drained from `current` below. The
            // `Opened` arm further down keeps handling file URLs.
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                launch::queue_deep_links(&handle, event.urls());
            });
            #[cfg(any(windows, target_os = "linux"))]
            {
                if let Err(error) = app.deep_link().register_all() {
                    eprintln!("[deep-link] register_all failed: {error}");
                }
            }
            // Every desktop platform can deliver the launch link before this closure
            // runs, which means before the listener above exists, and the plugin's
            // `deep-link://new-url` emit then reaches nobody:
            //
            // - Windows / Linux: the link is argv, and the plugin parses it in its own
            //   setup (`handle_cli_arguments`).
            // - macOS: AppKit delivers the GetURL event *before* the app's setup. Traced
            //   on a cold `open openpencil://…`: `RunEvent::Opened` at T+0.085 s, this
            //   closure at T+0.342 s, and `on_open_url` never fired.
            //
            // In all three cases the URL survives only in the plugin's `current`, so it
            // is read here. No link can be queued twice: `RunEvent::Opened` is dispatched
            // on the main thread, the same thread this closure runs on, so a link cannot
            // arrive between the registration above and this read — anything later goes
            // to `on_open_url` and is no longer in `current` by the time it is read.
            if let Ok(Some(urls)) = app.deep_link().get_current() {
                launch::queue_deep_links(app.handle(), urls);
            }

            Ok(install_app_menu(
                app.handle(),
                &NativeMenuInputs::default(),
            )?)
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, event| match event {
            tauri::RunEvent::ExitRequested {
                api, code: None, ..
            } if !_app.webview_windows().is_empty() => {
                api.prevent_exit();
                // The frontend asks about unsaved documents and exits when they agree.
                let _ = _app.emit("menu-event", "quit");
            }
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Opened { urls } => {
                let paths = urls
                    .into_iter()
                    .filter_map(|url| url.to_file_path().ok())
                    .filter_map(args::file_association_path)
                    .collect();
                launch::queue_open_paths(_app, paths);
            }
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Reopen {
                has_visible_windows: false,
                ..
            } => show_main_window(_app),
            _ => {}
        });
}
