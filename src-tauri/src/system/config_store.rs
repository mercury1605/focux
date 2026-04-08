use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::AppHandle;
use tauri::Manager;

fn app_storage_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    Ok(root)
}

fn config_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app_storage_root(app)?;
    let dir = root.join("config");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("config.json"))
}

fn assets_dir_path(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app_storage_root(app)?;
    let dir = root.join("assets").join("backgrounds");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn font_assets_dir_path(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app_storage_root(app)?;
    let dir = root.join("assets").join("fonts");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn safe_ext(file_name: &str) -> &'static str {
    let lower = file_name.to_lowercase();
    if lower.ends_with(".png") {
        "png"
    } else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        "jpg"
    } else {
        "png"
    }
}

fn safe_font_ext(file_name: &str) -> &'static str {
    let lower = file_name.to_lowercase();
    if lower.ends_with(".ttf") {
        "ttf"
    } else if lower.ends_with(".otf") {
        "otf"
    } else if lower.ends_with(".woff2") {
        "woff2"
    } else if lower.ends_with(".woff") {
        "woff"
    } else {
        "ttf"
    }
}

pub fn save_config_json(app: &AppHandle, config_json: &str) -> Result<bool, String> {
    let path = config_file_path(app)?;
    fs::write(path, config_json.as_bytes()).map_err(|e| e.to_string())?;
    Ok(true)
}

pub fn load_config_json(app: &AppHandle) -> Result<Option<String>, String> {
    let path = config_file_path(app)?;
    if !Path::new(&path).exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    Ok(Some(content))
}

pub fn save_background_image_asset(
    app: &AppHandle,
    file_name: &str,
    data_base64: &str,
) -> Result<String, String> {
    let bytes = STANDARD.decode(data_base64).map_err(|e| e.to_string())?;
    let ext = safe_ext(file_name);

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let file_name = format!("bg_{}.{}", now, ext);

    let path = assets_dir_path(app)?.join(file_name);
    fs::write(&path, bytes).map_err(|e| e.to_string())?;

    Ok(path.to_string_lossy().to_string())
}

pub fn save_font_asset(
    app: &AppHandle,
    file_name: &str,
    data_base64: &str,
) -> Result<String, String> {
    let bytes = STANDARD.decode(data_base64).map_err(|e| e.to_string())?;
    let ext = safe_font_ext(file_name);

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let file_name = format!("font_{}.{}", now, ext);

    let path = font_assets_dir_path(app)?.join(file_name);
    fs::write(&path, bytes).map_err(|e| e.to_string())?;

    Ok(path.to_string_lossy().to_string())
}
