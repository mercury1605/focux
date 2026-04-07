// src/services/commands.ts
import { invoke } from "@tauri-apps/api/core";

// Định nghĩa Type an toàn khớp với Struct bên Rust
export interface AppInfo {
  name: string;
  path: string;
  kind: string;
  icon?: string;
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

export async function launchApp(path: string): Promise<void> {
  try {
    await invoke("launch_app", { path });
  } catch (error) {
    console.error("Không thể mở ứng dụng:", error);
  }
}
