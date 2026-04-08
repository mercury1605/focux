use super::apps::AppInfo;
use arboard::Clipboard;
use base64::{engine::general_purpose::STANDARD, Engine as _};
use image::{DynamicImage, ImageOutputFormat, RgbaImage};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::io::Cursor;
use std::sync::atomic::AtomicBool;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::Duration;
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_CLIPBOARD_HISTORY: usize = 100;
const MAX_TEXT_PREVIEW_CHARS: usize = 4000;

#[derive(Clone, Debug)]
enum ClipboardPayload {
    Text(String),
    ImageDataUrl(String),
}

#[derive(Clone, Debug)]
struct ClipboardEntry {
    id: String,
    modified_unix: u64,
    fingerprint: u64,
    payload: ClipboardPayload,
}

#[derive(Default)]
struct ClipboardState {
    entries: Vec<ClipboardEntry>,
}

static CLIPBOARD_STATE: OnceLock<Mutex<ClipboardState>> = OnceLock::new();
static ENTRY_COUNTER: AtomicU64 = AtomicU64::new(1);
static WATCHER_STARTED: AtomicBool = AtomicBool::new(false);

fn clipboard_state() -> &'static Mutex<ClipboardState> {
    CLIPBOARD_STATE.get_or_init(|| Mutex::new(ClipboardState::default()))
}

fn now_unix_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn hash_text(s: &str) -> u64 {
    let mut hasher = DefaultHasher::new();
    "text".hash(&mut hasher);
    s.hash(&mut hasher);
    hasher.finish()
}

fn hash_image(bytes: &[u8], width: usize, height: usize) -> u64 {
    let mut hasher = DefaultHasher::new();
    "image".hash(&mut hasher);
    width.hash(&mut hasher);
    height.hash(&mut hasher);
    bytes.hash(&mut hasher);
    hasher.finish()
}

fn image_to_data_url(bytes: &[u8], width: usize, height: usize) -> Option<String> {
    let rgba = RgbaImage::from_raw(width as u32, height as u32, bytes.to_vec())?;
    let thumb = DynamicImage::ImageRgba8(rgba).thumbnail(360, 220);

    let mut cursor = Cursor::new(Vec::new());
    if thumb.write_to(&mut cursor, ImageOutputFormat::Png).is_err() {
        return None;
    }

    let b64 = STANDARD.encode(cursor.into_inner());
    Some(format!("data:image/png;base64,{}", b64))
}

fn push_history(state: &mut ClipboardState, payload: ClipboardPayload, fingerprint: u64) {
    if state
        .entries
        .first()
        .map(|e| e.fingerprint == fingerprint)
        .unwrap_or(false)
    {
        return;
    }

    let entry = ClipboardEntry {
        id: format!("clip-{}", ENTRY_COUNTER.fetch_add(1, Ordering::Relaxed)),
        modified_unix: now_unix_secs(),
        fingerprint,
        payload,
    };

    state.entries.insert(0, entry);
    if state.entries.len() > MAX_CLIPBOARD_HISTORY {
        state.entries.truncate(MAX_CLIPBOARD_HISTORY);
    }
}

fn refresh_from_system_clipboard(state: &mut ClipboardState) {
    let mut clipboard = match Clipboard::new() {
        Ok(c) => c,
        Err(_) => return,
    };

    if let Ok(text) = clipboard.get_text() {
        let fingerprint = hash_text(&text);
        push_history(state, ClipboardPayload::Text(text), fingerprint);
        return;
    }

    if let Ok(image) = clipboard.get_image() {
        let raw = image.bytes.into_owned();
        let fingerprint = hash_image(&raw, image.width, image.height);
        if let Some(data_url) = image_to_data_url(&raw, image.width, image.height) {
            push_history(state, ClipboardPayload::ImageDataUrl(data_url), fingerprint);
        }
    }
}

fn ensure_clipboard_watcher() {
    if WATCHER_STARTED
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return;
    }

    thread::spawn(|| loop {
        if let Ok(mut guard) = clipboard_state().lock() {
            refresh_from_system_clipboard(&mut guard);
        }
        thread::sleep(Duration::from_millis(450));
    });
}

fn entry_matches_query(entry: &ClipboardEntry, query: &str) -> bool {
    if query.is_empty() {
        return true;
    }

    let q = query.to_lowercase();
    match &entry.payload {
        ClipboardPayload::Text(t) => t.to_lowercase().contains(&q),
        ClipboardPayload::ImageDataUrl(_) => "image".contains(&q) || "clipboard".contains(&q),
    }
}

fn build_name(payload: &ClipboardPayload) -> String {
    match payload {
        ClipboardPayload::Text(text) => {
            let first_line = text.lines().next().unwrap_or("").trim();
            if first_line.is_empty() {
                "Clipboard Text".to_string()
            } else {
                let mut s = first_line.chars().take(42).collect::<String>();
                if first_line.chars().count() > 42 {
                    s.push('…');
                }
                s
            }
        }
        ClipboardPayload::ImageDataUrl(_) => "Clipboard Image".to_string(),
    }
}

fn payload_char_count(payload: &ClipboardPayload) -> u64 {
    match payload {
        ClipboardPayload::Text(text) => text.chars().count() as u64,
        ClipboardPayload::ImageDataUrl(_) => 0,
    }
}

pub fn search_clipboard(query: &str) -> Result<Vec<AppInfo>, String> {
    ensure_clipboard_watcher();

    let mut guard = clipboard_state()
        .lock()
        .map_err(|_| "clipboard state lock poisoned")?;

    refresh_from_system_clipboard(&mut guard);

    let q = query.trim();

    let mut entries = guard.entries.clone();
    entries.sort_by(|a, b| b.modified_unix.cmp(&a.modified_unix));

    let result = entries
        .into_iter()
        .filter(|entry| entry_matches_query(entry, q))
        .take(80)
        .map(|entry| {
            let (clip_type, clip_text, clip_image) = match entry.payload.clone() {
                ClipboardPayload::Text(t) => {
                    let trimmed = if t.chars().count() > MAX_TEXT_PREVIEW_CHARS {
                        t.chars().take(MAX_TEXT_PREVIEW_CHARS).collect::<String>()
                    } else {
                        t
                    };
                    ("text".to_string(), Some(trimmed), None)
                }
                ClipboardPayload::ImageDataUrl(url) => ("image".to_string(), None, Some(url)),
            };

            let payload_ref = match (&clip_text, &clip_image) {
                (Some(t), _) => ClipboardPayload::Text(t.clone()),
                (_, Some(u)) => ClipboardPayload::ImageDataUrl(u.clone()),
                _ => ClipboardPayload::Text(String::new()),
            };

            AppInfo {
                name: build_name(&payload_ref),
                path: String::new(),
                kind: "Clipboard".to_string(),
                icon: None,
                size_bytes: None,
                entry_id: Some(entry.id),
                char_count: Some(payload_char_count(&payload_ref)),
                clipboard_text: clip_text,
                clipboard_image_data_url: clip_image,
                clipboard_type: Some(clip_type),
            }
        })
        .collect();

    Ok(result)
}

pub fn delete_clipboard_item(entry_id: &str) -> Result<bool, String> {
    let mut guard = clipboard_state()
        .lock()
        .map_err(|_| "clipboard state lock poisoned")?;

    let before = guard.entries.len();
    guard.entries.retain(|e| e.id != entry_id);
    Ok(guard.entries.len() != before)
}
