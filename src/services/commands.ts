// src/services/commands.ts
import { invoke } from "@tauri-apps/api/core";

// Định nghĩa Type an toàn khớp với Struct bên Rust
export interface AppInfo {
  name: string;
  path: string;
  kind: string;
  icon?: string;
  sizeBytes?: number;
  entryId?: string;
  charCount?: number;
  clipboardText?: string;
  clipboardImageDataUrl?: string;
  clipboardType?: "text" | "image" | string;
}

export async function fetchAppsFromSystem(): Promise<AppInfo[]> {
  try {
    // Gọi command "fetch_apps" đã đăng ký bên Rust
    return await invoke<AppInfo[]>("fetch_apps");
  } catch (error) {
    console.error("Lỗi lấy danh sách app:", error);
    return [];
  }
}

export async function getAppIconFromSystem(
  path: string,
): Promise<string | null> {
  try {
    return await invoke<string | null>("get_app_icon_cmd", { path });
  } catch (error) {
    console.error("Failed to get app icon:", error);
    return null;
  }
}

export async function searchFoldersFromSystem(
  query: string,
): Promise<AppInfo[]> {
  try {
    return await invoke<AppInfo[]>("search_folders_cmd", { query });
  } catch (error) {
    console.error("Failed to search folders:", error);
    return [];
  }
}

export async function setFolderIndexOptions(
  maxDepth: number,
  maxEntries: number,
): Promise<boolean> {
  try {
    return await invoke<boolean>("set_folder_index_options_cmd", {
      maxDepth,
      maxEntries,
    });
  } catch (error) {
    console.error("Failed to update folder index options:", error);
    return false;
  }
}

export async function setLaunchWithWindows(enabled: boolean): Promise<boolean> {
  try {
    return await invoke<boolean>("set_launch_with_windows_cmd", { enabled });
  } catch (error) {
    console.error("Failed to set launch with windows:", error);
    return false;
  }
}

export async function getLaunchWithWindows(): Promise<boolean> {
  try {
    return await invoke<boolean>("get_launch_with_windows_cmd");
  } catch (error) {
    console.error("Failed to get launch with windows:", error);
    return false;
  }
}

export async function searchClipboardFromSystem(
  query: string,
): Promise<AppInfo[]> {
  try {
    return await invoke<AppInfo[]>("search_clipboard_cmd", { query });
  } catch (error) {
    console.error("Failed to search clipboard:", error);
    return [];
  }
}

export async function deleteClipboardItemFromSystem(
  entryId: string,
): Promise<boolean> {
  try {
    return await invoke<boolean>("delete_clipboard_item_cmd", { entryId });
  } catch (error) {
    console.error("Failed to delete clipboard item:", error);
    return false;
  }
}

export async function launchApp(path: string): Promise<void> {
  try {
    await invoke("launch_app", { path });
  } catch (error) {
    console.error("Không thể mở ứng dụng:", error);
  }
}
