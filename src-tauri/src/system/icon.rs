// src-tauri/src/system/icon.rs
use std::collections::HashMap;
use std::ffi::OsStr;
use std::io::Cursor;
use std::os::windows::ffi::OsStrExt;
use std::path::Path;
use std::sync::{Mutex, OnceLock};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use image::{ImageOutputFormat, RgbaImage};

use windows::core::{ComInterface, PCWSTR};
use windows::Win32::Graphics::Gdi::{
    CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, BITMAPINFO, BITMAPINFOHEADER, BI_RGB,
    DIB_RGB_COLORS,
};
use windows::Win32::Storage::FileSystem::{FILE_FLAGS_AND_ATTRIBUTES, WIN32_FIND_DATAW};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, IPersistFile, CLSCTX_INPROC_SERVER,
    COINIT_APARTMENTTHREADED, STGM_READ,
};
use windows::Win32::UI::Shell::{IShellLinkW, ShellLink};
use windows::Win32::UI::Shell::{SHGetFileInfoW, SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON};
use windows::Win32::UI::WindowsAndMessaging::{DestroyIcon, GetIconInfo, HICON, ICONINFO};

static ICON_CACHE: OnceLock<Mutex<HashMap<String, Option<String>>>> = OnceLock::new();

/// Chuyển đổi đường dẫn String của Rust sang UTF-16 (chuẩn của Windows)
fn to_wstring(str: &str) -> Vec<u16> {
    let mut v: Vec<u16> = OsStr::new(str).encode_wide().collect();
    v.push(0); // Chuỗi trong C/C++ luôn phải kết thúc bằng null (\0)
    v
}

/// Trích xuất icon từ file và trả về chuỗi Base64 (PNG)
pub fn get_icon_base64(path: &str) -> Option<String> {
    // Nếu là shortcut (.lnk), resolve sang target thật để tránh overlay mũi tên
    let icon_source = if Path::new(path)
        .extension()
        .and_then(|s| s.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case("lnk"))
    {
        resolve_shortcut_target(path).unwrap_or_else(|| path.to_string())
    } else {
        path.to_string()
    };

    // WinAPI thao tác trực tiếp với bộ nhớ, nên bắt buộc phải nằm trong block `unsafe`
    unsafe {
        let path_w = to_wstring(&icon_source);
        let mut shfi: SHFILEINFOW = std::mem::zeroed();

        // 1. GỌI WINDOWS SHELL ĐỂ LẤY HICON (Handle to Icon)
        let result = SHGetFileInfoW(
            PCWSTR(path_w.as_ptr()),
            FILE_FLAGS_AND_ATTRIBUTES(0),
            Some(&mut shfi),
            std::mem::size_of::<SHFILEINFOW>() as u32,
            SHGFI_ICON | SHGFI_LARGEICON, // Yêu cầu icon và size lớn
        );

        if result == 0 || shfi.hIcon.is_invalid() {
            return None; // Không lấy được icon
        }

        let hicon = shfi.hIcon;

        // 2. CHUYỂN HICON THÀNH PIXEL DATA
        let base64_str = hicon_to_base64(hicon);

        // 3. DỌN DẸP BỘ NHỚ (Memory Leak sẽ xảy ra nếu quên dòng này!)
        let _ = DestroyIcon(hicon);

        base64_str
    }
}

/// Lấy icon có cache theo path để giảm thời gian load danh sách app.
pub fn get_icon_base64_cached(path: &str) -> Option<String> {
    let cache = ICON_CACHE.get_or_init(|| Mutex::new(HashMap::new()));

    if let Ok(map) = cache.lock() {
        if let Some(cached) = map.get(path) {
            return cached.clone();
        }
    }

    let icon = get_icon_base64(path);

    if let Ok(mut map) = cache.lock() {
        if map.len() > 5000 {
            map.clear();
        }
        map.insert(path.to_string(), icon.clone());
    }

    icon
}

/// Resolve đường dẫn target thật của file shortcut (.lnk)
fn resolve_shortcut_target(shortcut_path: &str) -> Option<String> {
    unsafe {
        let mut should_uninit = false;
        if CoInitializeEx(None, COINIT_APARTMENTTHREADED).is_ok() {
            should_uninit = true;
        }

        let shell_link: IShellLinkW =
            CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER).ok()?;
        let persist_file: IPersistFile = shell_link.cast().ok()?;

        let shortcut_w = to_wstring(shortcut_path);
        persist_file
            .Load(PCWSTR(shortcut_w.as_ptr()), STGM_READ)
            .ok()?;

        let mut target_buf = vec![0u16; 32768];
        let mut find_data: WIN32_FIND_DATAW = std::mem::zeroed();

        shell_link
            .GetPath(&mut target_buf, &mut find_data, 0)
            .ok()?;

        if should_uninit {
            CoUninitialize();
        }

        let len = target_buf
            .iter()
            .position(|&c| c == 0)
            .unwrap_or(target_buf.len());
        if len == 0 {
            return None;
        }

        Some(String::from_utf16_lossy(&target_buf[..len]))
    }
}

/// Chuyển HICON của Windows thành ảnh PNG rồi encode Base64
unsafe fn hicon_to_base64(hicon: HICON) -> Option<String> {
    let mut icon_info: ICONINFO = std::mem::zeroed();
    if GetIconInfo(hicon, &mut icon_info).is_err() {
        return None;
    }

    // Windows Icon bao gồm 2 phần: Color (Màu) và Mask (Vùng trong suốt)
    let hbm_color = icon_info.hbmColor;
    let hbm_mask = icon_info.hbmMask;

    let hdc = CreateCompatibleDC(None);
    if hdc.is_invalid() {
        let _ = DeleteObject(hbm_color);
        let _ = DeleteObject(hbm_mask);
        return None;
    }

    // Thiết lập cấu trúc để đọc pixel: 32-bit màu ARGB
    let mut bmi: BITMAPINFO = std::mem::zeroed();
    bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;

    // Lấy thông tin chiều rộng/cao của ảnh trước
    if GetDIBits(hdc, hbm_color, 0, 0, None, &mut bmi, DIB_RGB_COLORS) == 0 {
        let _ = DeleteDC(hdc);
        let _ = DeleteObject(hbm_color);
        let _ = DeleteObject(hbm_mask);
        return None;
    }

    let width = bmi.bmiHeader.biWidth as u32;
    let height = bmi.bmiHeader.biHeight.abs() as u32;

    // Chuẩn bị buffer (mảng byte) để chứa dữ liệu pixel (Width * Height * 4 bytes ARGB)
    let mut pixels: Vec<u8> = vec![0; (width * height * 4) as usize];

    // Cập nhật lại header để ép Windows trả về 32-bit (chống lỗi với icon cũ)
    bmi.bmiHeader.biBitCount = 32;
    bmi.bmiHeader.biCompression = BI_RGB.0 as u32;
    bmi.bmiHeader.biHeight = -(height as i32); // Số âm để ảnh không bị lộn ngược (top-down)

    // Thực sự đọc pixel từ GPU/RAM nhét vào buffer `pixels`
    let scanlines = GetDIBits(
        hdc,
        hbm_color,
        0,
        height,
        Some(pixels.as_mut_ptr() as *mut _),
        &mut bmi,
        DIB_RGB_COLORS,
    );

    // Dọn dẹp GDI Objects
    let _ = DeleteDC(hdc);
    let _ = DeleteObject(hbm_color);
    let _ = DeleteObject(hbm_mask);

    if scanlines == 0 {
        return None;
    }

    // 4. CONVERT BGRA (Windows) SANG RGBA (Web chuẩn)
    // Pixel của Windows xếp theo thứ tự Blue-Green-Red-Alpha, Web cần Red-Green-Blue-Alpha
    for chunk in pixels.chunks_exact_mut(4) {
        chunk.swap(0, 2); // Đổi chỗ byte B và byte R
    }

    // 5. TẠO ẢNH PNG VÀ ENCODE BASE64
    if let Some(img) = RgbaImage::from_raw(width, height, pixels) {
        let mut cursor = Cursor::new(Vec::new());
        // Nén ảnh lại thành định dạng PNG
        if img.write_to(&mut cursor, ImageOutputFormat::Png).is_ok() {
            let png_bytes = cursor.into_inner();
            // Đóng gói thành chuỗi base64 có prefix để xài luôn trong thẻ <img src="...">
            let b64 = STANDARD.encode(png_bytes);
            return Some(format!("data:image/png;base64,{}", b64));
        }
    }

    None
}
