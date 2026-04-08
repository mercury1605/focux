mod commands;
mod system;

use commands::app_cmd;
use std::str::FromStr;
use tauri::Manager;
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState}; // Import command vừa tạo

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // ĐĂNG KÝ COMMAND TẠI ĐÂY
        .invoke_handler(tauri::generate_handler![
            app_cmd::fetch_apps,
            app_cmd::search_folders_cmd,
            app_cmd::set_folder_index_options_cmd,
            app_cmd::set_launch_with_windows_cmd,
            app_cmd::get_launch_with_windows_cmd,
            app_cmd::save_config_json_cmd,
            app_cmd::load_config_json_cmd,
            app_cmd::save_background_image_asset_cmd,
            app_cmd::save_font_asset_cmd,
            app_cmd::search_clipboard_cmd,
            app_cmd::delete_clipboard_item_cmd,
            app_cmd::launch_app
        ])
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None::<Vec<&'static str>>,
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        // Vị trí 1: Đổi Modifiers::SUPER thành Modifiers::ALT
                        if shortcut.matches(Modifiers::ALT, Code::Space) {
                            if let Some(window) = app.get_webview_window("main") {
                                let is_visible = window.is_visible().unwrap_or(false);
                                if is_visible {
                                    window.hide().unwrap();
                                } else {
                                    window.show().unwrap();
                                    window.set_focus().unwrap();
                                }
                            }
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            #[cfg(desktop)]
            {
                // Vị trí 2: Đổi chuỗi "Super+Space" thành "Alt+Space"
                let shortcut = Shortcut::from_str("Alt+Space").unwrap();

                // (Tùy chọn nâng cao) Thay vì unwrap() gây crash, ta có thể log ra lỗi nếu phím bị trùng
                match app.global_shortcut().register(shortcut) {
                    Ok(_) => println!("Đã đăng ký phím Alt+Space thành công!"),
                    Err(e) => eprintln!("Không thể đăng ký phím tắt: {}", e),
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
