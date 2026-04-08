use super::apps::AppInfo;
use directories::UserDirs;
use std::collections::HashSet;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{OnceLock, RwLock};
use std::thread;
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;

const MAX_FOLDER_RESULTS: usize = 200;
const DEFAULT_FAST_MAX_DEPTH: usize = 6;
const DEFAULT_INDEX_LIMIT: usize = 25_000;

const EXCLUDED_DIR_NAMES: &[&str] = &[
    "windows",
    "program files",
    "program files (x86)",
    "programdata",
    "appdata",
    "$recycle.bin",
    "system volume information",
    "node_modules",
    ".git",
    "target",
    "dist",
    ".next",
    ".cache",
    "venv",
    ".venv",
];

#[derive(Clone, Debug)]
struct FolderEntry {
    name: String,
    path: String,
    name_lower: String,
    path_lower: String,
    modified_unix: u64,
}

static FOLDER_CACHE: OnceLock<RwLock<Vec<FolderEntry>>> = OnceLock::new();
static FULL_FOLDER_CACHE: OnceLock<RwLock<Vec<FolderEntry>>> = OnceLock::new();
static FOLDER_INDEX_DEPTH: OnceLock<RwLock<usize>> = OnceLock::new();
static FOLDER_INDEX_LIMIT: OnceLock<RwLock<usize>> = OnceLock::new();
static FOLDER_INDEXING: AtomicBool = AtomicBool::new(false);
static FOLDER_INDEX_READY: AtomicBool = AtomicBool::new(false);
static FULL_FOLDER_INDEXING: AtomicBool = AtomicBool::new(false);
static FULL_FOLDER_INDEX_READY: AtomicBool = AtomicBool::new(false);

fn folder_cache() -> &'static RwLock<Vec<FolderEntry>> {
    FOLDER_CACHE.get_or_init(|| RwLock::new(Vec::new()))
}

fn full_folder_cache() -> &'static RwLock<Vec<FolderEntry>> {
    FULL_FOLDER_CACHE.get_or_init(|| RwLock::new(Vec::new()))
}

fn folder_index_depth() -> &'static RwLock<usize> {
    FOLDER_INDEX_DEPTH.get_or_init(|| RwLock::new(DEFAULT_FAST_MAX_DEPTH))
}

fn folder_index_limit() -> &'static RwLock<usize> {
    FOLDER_INDEX_LIMIT.get_or_init(|| RwLock::new(DEFAULT_INDEX_LIMIT))
}

fn windows_drive_roots() -> Vec<String> {
    let mut drives = Vec::new();
    for c in b'A'..=b'Z' {
        let root = format!("{}:\\", c as char);
        if Path::new(&root).exists() {
            drives.push(root);
        }
    }
    drives
}

fn user_relevant_roots() -> Vec<String> {
    let mut roots = Vec::<String>::new();

    if let Some(user_dirs) = UserDirs::new() {
        if let Some(home) = user_dirs.home_dir().to_str() {
            roots.push(home.to_string());
        }
        if let Some(desktop) = user_dirs.desktop_dir().and_then(|p| p.to_str()) {
            roots.push(desktop.to_string());
        }
        if let Some(document) = user_dirs.document_dir().and_then(|p| p.to_str()) {
            roots.push(document.to_string());
        }
        if let Some(download) = user_dirs.download_dir().and_then(|p| p.to_str()) {
            roots.push(download.to_string());
        }
        if let Some(picture) = user_dirs.picture_dir().and_then(|p| p.to_str()) {
            roots.push(picture.to_string());
        }
        if let Some(video) = user_dirs.video_dir().and_then(|p| p.to_str()) {
            roots.push(video.to_string());
        }
        if let Some(audio) = user_dirs.audio_dir().and_then(|p| p.to_str()) {
            roots.push(audio.to_string());
        }

        if let Some(home) = user_dirs.home_dir().to_str() {
            let extra = ["OneDrive", "Dev", "Projects", "Workspace", "Source"];
            for name in extra {
                let p = format!("{}\\{}", home, name);
                if Path::new(&p).exists() {
                    roots.push(p);
                }
            }
        }
    }

    // Add non-system drives (e.g. D:, E:) so normal @d search can find user folders there.
    // Keep system drive out of this list because it is already covered by user-known folders.
    let system_drive = std::env::var("SystemDrive")
        .ok()
        .map(|v| v.to_uppercase())
        .unwrap_or_else(|| "C:".to_string());

    for drive in windows_drive_roots() {
        let normalized = drive.trim_end_matches('\\').to_uppercase();
        if normalized != system_drive {
            roots.push(drive);
        }
    }

    roots.sort();
    roots.dedup();
    roots
}

fn should_skip_dir_name(name: &str) -> bool {
    let lower = name.to_lowercase();
    EXCLUDED_DIR_NAMES.contains(&lower.as_str())
}

fn path_modified_unix(path: &Path) -> u64 {
    path.metadata()
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn collect_folder_entries(
    roots: &[String],
    max_depth: Option<usize>,
    max_entries: usize,
) -> Vec<FolderEntry> {
    let mut folders = Vec::new();
    let mut seen = HashSet::<String>::new();

    for root in roots {
        let root_path = Path::new(root);
        if !root_path.exists() || !root_path.is_dir() {
            continue;
        }

        let mut walker = WalkDir::new(root).follow_links(false);
        if let Some(depth) = max_depth {
            walker = walker.max_depth(depth);
        }

        for entry in walker
            .into_iter()
            .filter_entry(|e| {
                if !e.file_type().is_dir() {
                    return true;
                }
                if e.depth() == 0 {
                    return true;
                }

                e.file_name()
                    .to_str()
                    .map(|n| !should_skip_dir_name(n))
                    .unwrap_or(false)
            })
            .filter_map(|e| e.ok())
        {
            if folders.len() >= max_entries {
                break;
            }

            if !entry.file_type().is_dir() {
                continue;
            }

            let path = entry.path();
            if path == root_path {
                continue;
            }

            let name = match path.file_name().and_then(|s| s.to_str()) {
                Some(v) if !v.is_empty() => v.to_string(),
                _ => continue,
            };

            let path_string = path.to_string_lossy().to_string();
            let key = path_string.to_lowercase();
            if seen.contains(&key) {
                continue;
            }
            seen.insert(key.clone());

            folders.push(FolderEntry {
                name: name.clone(),
                path: path_string.clone(),
                name_lower: name.to_lowercase(),
                path_lower: key,
                modified_unix: path_modified_unix(path),
            });
        }
    }

    folders.sort_by(|a, b| b.modified_unix.cmp(&a.modified_unix));
    folders
}

fn seed_common_folders() -> Vec<FolderEntry> {
    let mut seed_paths = Vec::<String>::new();

    if let Some(user_dirs) = UserDirs::new() {
        if let Some(home) = user_dirs.home_dir().to_str() {
            seed_paths.push(home.to_string());
        }
        if let Some(desktop) = user_dirs.desktop_dir().and_then(|p| p.to_str()) {
            seed_paths.push(desktop.to_string());
        }
        if let Some(document) = user_dirs.document_dir().and_then(|p| p.to_str()) {
            seed_paths.push(document.to_string());
        }
        if let Some(download) = user_dirs.download_dir().and_then(|p| p.to_str()) {
            seed_paths.push(download.to_string());
        }
    }

    let mut entries = Vec::new();
    for p in seed_paths {
        let path = Path::new(&p);
        if !path.exists() || !path.is_dir() {
            continue;
        }

        let name = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("Folder")
            .to_string();

        let modified_unix = path_modified_unix(path);

        entries.push(FolderEntry {
            name: name.clone(),
            path: p.clone(),
            name_lower: name.to_lowercase(),
            path_lower: p.to_lowercase(),
            modified_unix,
        });
    }

    entries.sort_by(|a, b| b.modified_unix.cmp(&a.modified_unix));
    entries
}

fn build_folder_cache() -> Vec<FolderEntry> {
    let max_entries = folder_index_limit()
        .read()
        .map(|v| *v)
        .unwrap_or(DEFAULT_INDEX_LIMIT);

    collect_folder_entries(&windows_drive_roots(), None, max_entries)
}

fn build_fast_folder_cache() -> Vec<FolderEntry> {
    let depth = folder_index_depth()
        .read()
        .map(|v| *v)
        .unwrap_or(DEFAULT_FAST_MAX_DEPTH);

    let max_entries = folder_index_limit()
        .read()
        .map(|v| *v)
        .unwrap_or(DEFAULT_INDEX_LIMIT);

    collect_folder_entries(&user_relevant_roots(), Some(depth), max_entries)
}

pub fn set_folder_index_options(max_depth: usize, max_entries: usize) -> Result<bool, String> {
    let safe_depth = max_depth.clamp(1, 20);
    let safe_entries = max_entries.clamp(2_000, 200_000);

    {
        let mut d = folder_index_depth()
            .write()
            .map_err(|_| "folder index depth lock poisoned")?;
        *d = safe_depth;
    }

    {
        let mut l = folder_index_limit()
            .write()
            .map_err(|_| "folder index limit lock poisoned")?;
        *l = safe_entries;
    }

    if let Ok(mut fast) = folder_cache().write() {
        fast.clear();
    }

    if let Ok(mut full) = full_folder_cache().write() {
        full.clear();
    }

    FOLDER_INDEX_READY.store(false, Ordering::Release);
    FULL_FOLDER_INDEX_READY.store(false, Ordering::Release);
    FOLDER_INDEXING.store(false, Ordering::Release);
    FULL_FOLDER_INDEXING.store(false, Ordering::Release);

    Ok(true)
}

fn ensure_background_indexing() {
    if FOLDER_INDEX_READY.load(Ordering::Acquire) {
        return;
    }

    if FOLDER_INDEXING
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .is_err()
    {
        return;
    }

    // Seed quick results immediately so first @d query is responsive.
    if let Ok(mut cache) = folder_cache().write() {
        if cache.is_empty() {
            *cache = seed_common_folders();
        }
    }

    thread::spawn(|| {
        let fast_index = build_fast_folder_cache();

        if let Ok(mut cache) = folder_cache().write() {
            *cache = fast_index;
            FOLDER_INDEX_READY.store(true, Ordering::Release);
        }

        FOLDER_INDEXING.store(false, Ordering::Release);
    });
}

fn ensure_full_background_indexing() {
    if FULL_FOLDER_INDEX_READY.load(Ordering::Acquire) {
        return;
    }

    if FULL_FOLDER_INDEXING
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .is_err()
    {
        return;
    }

    if let Ok(mut cache) = full_folder_cache().write() {
        if cache.is_empty() {
            let seed = folder_cache().read().map(|c| c.clone()).unwrap_or_default();
            *cache = if seed.is_empty() {
                seed_common_folders()
            } else {
                seed
            };
        }
    }

    thread::spawn(|| {
        let full_index = build_folder_cache();

        if let Ok(mut cache) = full_folder_cache().write() {
            *cache = full_index;
            FULL_FOLDER_INDEX_READY.store(true, Ordering::Release);
        }

        FULL_FOLDER_INDEXING.store(false, Ordering::Release);
    });
}

fn match_rank(entry: &FolderEntry, query_lower: &str, child_marker: &str) -> u8 {
    if entry.name_lower == query_lower {
        return 0;
    }

    if entry.name_lower.starts_with(query_lower) {
        return 1;
    }

    if entry.name_lower.contains(query_lower) {
        return 2;
    }

    // Child folders of an exact-name folder (e.g. "...\focux\src") are intentionally lower priority.
    if entry.path_lower.contains(child_marker) {
        return 4;
    }

    if entry.path_lower.contains(query_lower) {
        return 3;
    }

    5
}

pub fn search_folders(query: &str) -> Result<Vec<AppInfo>, String> {
    let raw = query.trim();
    let is_full_scan = raw.starts_with('!');
    let q = if is_full_scan {
        raw.trim_start_matches('!').trim().to_lowercase()
    } else {
        raw.to_lowercase()
    };

    if is_full_scan {
        ensure_full_background_indexing();
    } else {
        ensure_background_indexing();
    }

    let cache_guard = if is_full_scan {
        full_folder_cache()
            .read()
            .map_err(|_| "full folder cache read lock poisoned")?
    } else {
        folder_cache()
            .read()
            .map_err(|_| "folder cache read lock poisoned")?
    };

    let mut matches: Vec<&FolderEntry> = cache_guard
        .iter()
        .filter(|entry| {
            q.is_empty() || entry.name_lower.contains(&q) || entry.path_lower.contains(&q)
        })
        .collect();

    if !q.is_empty() {
        let child_marker = format!("\\{}\\", q);
        matches.sort_by(|a, b| {
            let rank_a = match_rank(a, &q, &child_marker);
            let rank_b = match_rank(b, &q, &child_marker);

            rank_a
                .cmp(&rank_b)
                .then_with(|| b.modified_unix.cmp(&a.modified_unix))
        });
    }

    let result = matches
        .into_iter()
        .take(MAX_FOLDER_RESULTS)
        .map(|entry| AppInfo {
            name: entry.name.clone(),
            path: entry.path.clone(),
            kind: "Folder".to_string(),
            icon: None,
            size_bytes: None,
            entry_id: None,
            char_count: None,
            clipboard_text: None,
            clipboard_image_data_url: None,
            clipboard_type: None,
        })
        .collect();

    Ok(result)
}
