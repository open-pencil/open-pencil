//! The recent files the native menu lists.

use crate::menu::update_app_menu;

#[tauri::command]
pub fn set_recent_files(app: tauri::AppHandle, paths: Vec<String>) -> Result<(), String> {
    update_app_menu(&app, |inputs| inputs.recent_files = paths)
}
