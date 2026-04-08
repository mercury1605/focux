// src-tauri/src/commands/app_cmd.rs
use crate::system::apps::{get_installed_apps, AppInfo};
use crate::system::clipboard::{delete_clipboard_item, search_clipboard};
use crate::system::config_store::{
    load_config_json, save_background_image_asset, save_config_json, save_font_asset,
};
use crate::system::folders::{search_folders, set_folder_index_options};
use std::process::Command;
use tauri::AppHandle;
use tauri_plugin_autostart::ManagerExt;

#[tauri::command]
pub fn fetch_apps() -> Result<Vec<AppInfo>, String> {
    // Gọi hàm từ tầng system
    let apps = get_installed_apps();
    Ok(apps)
}

#[tauri::command]
pub fn search_folders_cmd(query: String) -> Result<Vec<AppInfo>, String> {
    search_folders(&query)
}

#[tauri::command]
pub fn set_folder_index_options_cmd(max_depth: usize, max_entries: usize) -> Result<bool, String> {
    set_folder_index_options(max_depth, max_entries)
}

#[tauri::command]
pub fn set_launch_with_windows_cmd(app: AppHandle, enabled: bool) -> Result<bool, String> {
    let manager = app.autolaunch();

    if enabled {
        manager.enable().map_err(|e| e.to_string())?;
    } else {
        manager.disable().map_err(|e| e.to_string())?;
    }

    manager.is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_launch_with_windows_cmd(app: AppHandle) -> Result<bool, String> {
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_config_json_cmd(app: AppHandle, config_json: String) -> Result<bool, String> {
    save_config_json(&app, &config_json)
}

#[tauri::command]
pub fn load_config_json_cmd(app: AppHandle) -> Result<Option<String>, String> {
    load_config_json(&app)
}

#[tauri::command]
pub fn save_background_image_asset_cmd(
    app: AppHandle,
    file_name: String,
    data_base64: String,
) -> Result<String, String> {
    save_background_image_asset(&app, &file_name, &data_base64)
}

#[tauri::command]
pub fn save_font_asset_cmd(
    app: AppHandle,
    file_name: String,
    data_base64: String,
) -> Result<String, String> {
    save_font_asset(&app, &file_name, &data_base64)
}

#[tauri::command]
pub fn search_clipboard_cmd(query: String) -> Result<Vec<AppInfo>, String> {
    search_clipboard(&query)
}

#[tauri::command]
pub fn delete_clipboard_item_cmd(entry_id: String) -> Result<bool, String> {
    delete_clipboard_item(&entry_id)
}

#[tauri::command]
pub fn launch_app(path: String) -> Result<(), String> {
    // Trên Windows, dùng lệnh "explorer" để mở file/folder/app một cách an toàn
    Command::new("explorer")
        .arg(path)
        .spawn() // Chạy độc lập, không đợi app kia đóng mới tiếp tục
        .map_err(|e| e.to_string())?;

    Ok(())
}
