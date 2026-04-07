// src-tauri/src/system/apps.rs
use super::icon::get_icon_base64_cached;
use directories::{BaseDirs, UserDirs}; // SỬA: Import thêm UserDirs
use serde::{Deserialize, Serialize};
use std::path::Path;
use walkdir::WalkDir;

// Khai báo cấu trúc dữ liệu sẽ trả về cho Frontend
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppInfo {
    pub name: String,
    pub path: String,
    pub kind: String,
    pub icon: Option<String>, // Thêm trường icon (Base64 string)
}

pub fn get_installed_apps() -> Vec<AppInfo> {
    let mut apps = Vec::new();

    // 1. Dùng BaseDirs cho các thư mục hệ thống (AppData)
    if let Some(base_dirs) = BaseDirs::new() {
        // Start Menu của User (%APPDATA%\Microsoft\Windows\Start Menu\Programs)
        let user_start_menu = base_dirs
            .data_dir()
            .join("Microsoft\\Windows\\Start Menu\\Programs");
        scan_directory(&user_start_menu, &mut apps);
    }

    // 2. Dùng UserDirs cho các thư mục cá nhân (Desktop)
    if let Some(user_dirs) = UserDirs::new() {
        // user_dirs.desktop_dir() trả về một Option<&Path>, nên ta dùng if let để an toàn
        if let Some(user_desktop) = user_dirs.desktop_dir() {
            scan_directory(user_desktop, &mut apps);
        }
    }

    // Start Menu chung của Hệ thống (C:\ProgramData\...)
    let system_start_menu = Path::new("C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs");
    scan_directory(system_start_menu, &mut apps);

    // Desktop chung của Hệ thống
    let system_desktop = Path::new("C:\\Users\\Public\\Desktop");
    scan_directory(system_desktop, &mut apps);

    // Xóa các app trùng lặp tên (nếu có) và sắp xếp A-Z
    apps.sort_by(|a, b| a.name.cmp(&b.name));
    apps.dedup_by(|a, b| a.name == b.name);

    // TỐI ƯU HIỆU NĂNG: Chỉ lấy icon cho 20 app đầu tiên
    for (i, app) in apps.iter_mut().enumerate() {
        if i < 20 {
            app.icon = get_icon_base64_cached(&app.path);
        } else {
            // Placeholder: "data:image/png;base64,..." một ảnh trong suốt siêu nhẹ
            // Hoặc để None nếu Frontend tự handle fallback
            app.icon = None;
        }
    }
    apps
}

// Hàm quét đệ quy thư mục để tìm file .lnk hoặc .exe
fn scan_directory(dir: &Path, apps: &mut Vec<AppInfo>) {
    if !dir.exists() {
        return;
    }

    for entry in WalkDir::new(dir).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
                if ext.eq_ignore_ascii_case("lnk") || ext.eq_ignore_ascii_case("exe") {
                    if let Some(file_stem) = path.file_stem().and_then(|s| s.to_str()) {
                        apps.push(AppInfo {
                            name: file_stem.to_string(),              // Tên file bỏ đuôi mở rộng
                            path: path.to_string_lossy().to_string(), // Đường dẫn đầy đủ
                            kind: "App".to_string(),
                            icon: None,
                        });
                    }
                }
            }
        }
    }
}
