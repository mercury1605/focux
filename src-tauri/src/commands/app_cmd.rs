// src-tauri/src/commands/app_cmd.rs
use crate::system::apps::{get_installed_apps, AppInfo};
use std::process::Command;

#[tauri::command]
pub fn fetch_apps() -> Result<Vec<AppInfo>, String> {
    // Gọi hàm từ tầng system
    let apps = get_installed_apps();
    Ok(apps)
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
