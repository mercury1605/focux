import { LogicalSize } from "@tauri-apps/api/dpi";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export type ThemeName = "default" | "sky" | "aurora";
export type LanguageCode = "en" | "vi";

export interface AppConfig {
  appearance: {
    startupResolution: string;
    textRed: number;
    textGreen: number;
    textBlue: number;
    textOpacity: number;
    theme: ThemeName;
  };
  advanced: {
    backgroundImageDataUrl: string;
    backgroundImageAsset: string;
    appFontDataUrl: string;
    appFontAsset: string;
    appFontFamily: string;
    backgroundBlur: number;
    backgroundOpacity: number;
    indexDepth: number;
    indexLimit: number;
    launchWithWindows: boolean;
    language: LanguageCode;
  };
  shortcut: {
    openSettingsShortcut: string;
  };
}

const CONFIG_KEY = "focux_config_v1";
let currentConfig: AppConfig;

export const DEFAULT_CONFIG: AppConfig = {
  appearance: {
    startupResolution: "800x600",
    textRed: 0.84,
    textGreen: 0.91,
    textBlue: 0.8,
    textOpacity: 1,
    theme: "default",
  },
  advanced: {
    backgroundImageDataUrl: "",
    backgroundImageAsset: "",
    appFontDataUrl: "",
    appFontAsset: "",
    appFontFamily: "",
    backgroundBlur: 8,
    backgroundOpacity: 0.35,
    indexDepth: 6,
    indexLimit: 25000,
    launchWithWindows: false,
    language: "en",
  },
  shortcut: {
    openSettingsShortcut: "Ctrl+S",
  },
};

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function clamp(v: number, min: number, max: number): number {
  if (Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}

export function normalizeConfig(partial?: Partial<AppConfig>): AppConfig {
  const merged: AppConfig = {
    appearance: {
      ...DEFAULT_CONFIG.appearance,
      ...(partial?.appearance ?? {}),
    },
    advanced: {
      ...DEFAULT_CONFIG.advanced,
      ...(partial?.advanced ?? {}),
    },
    shortcut: {
      ...DEFAULT_CONFIG.shortcut,
      ...(partial?.shortcut ?? {}),
    },
  };

  merged.appearance.textRed = clamp01(merged.appearance.textRed);
  merged.appearance.textGreen = clamp01(merged.appearance.textGreen);
  merged.appearance.textBlue = clamp01(merged.appearance.textBlue);
  merged.appearance.textOpacity = clamp01(merged.appearance.textOpacity);

  merged.advanced.backgroundOpacity = clamp01(
    merged.advanced.backgroundOpacity,
  );
  merged.advanced.backgroundBlur = clamp(merged.advanced.backgroundBlur, 0, 40);
  merged.advanced.indexDepth = Math.round(
    clamp(merged.advanced.indexDepth, 1, 20),
  );
  merged.advanced.indexLimit = Math.round(
    clamp(merged.advanced.indexLimit, 2000, 200000),
  );

  return merged;
}

function decodeBase64(input: string): string {
  try {
    return decodeURIComponent(escape(atob(input)));
  } catch {
    return atob(input);
  }
}

function extractMimeType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  return "application/octet-stream";
}

function extractFontMimeType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".ttf")) return "font/ttf";
  if (lower.endsWith(".otf")) return "font/otf";
  if (lower.endsWith(".woff2")) return "font/woff2";
  if (lower.endsWith(".woff")) return "font/woff";
  return "application/octet-stream";
}

function fontFamilyFromFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").trim() || "Focux User Font";
}

export async function initConfigStorage(): Promise<AppConfig> {
  try {
    const rawFromFile = await invoke<string | null>("load_config_json_cmd");
    if (rawFromFile) {
      const parsed = JSON.parse(rawFromFile) as Partial<AppConfig>;
      currentConfig = normalizeConfig(parsed);
      localStorage.setItem(CONFIG_KEY, JSON.stringify(currentConfig));
      return currentConfig;
    }
  } catch {
    // Fallback below
  }

  try {
    const rawLocal = localStorage.getItem(CONFIG_KEY);
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal) as Partial<AppConfig>;
      currentConfig = normalizeConfig(parsed);
      await saveConfig(currentConfig);
      return currentConfig;
    }
  } catch {
    // fallback to default
  }

  currentConfig = normalizeConfig(DEFAULT_CONFIG);
  await saveConfig(currentConfig);
  return currentConfig;
}

export function loadConfig(): AppConfig {
  if (!currentConfig) {
    currentConfig = normalizeConfig(DEFAULT_CONFIG);
  }
  return currentConfig;
}

export async function saveConfig(config: AppConfig): Promise<void> {
  currentConfig = normalizeConfig(config);
  const json = JSON.stringify(currentConfig, null, 2);
  localStorage.setItem(CONFIG_KEY, JSON.stringify(currentConfig));
  await invoke<boolean>("save_config_json_cmd", { configJson: json });
}

export async function importConfigJson(
  jsonContent: string,
): Promise<AppConfig> {
  const parsed = JSON.parse(jsonContent) as Partial<AppConfig>;
  const normalized = normalizeConfig(parsed);
  await saveConfig(normalized);
  return normalized;
}

export function exportConfigJson(): string {
  return JSON.stringify(loadConfig(), null, 2);
}

export async function saveBackgroundImageFile(file: File): Promise<{
  dataUrl: string;
  assetPath: string;
}> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  const base64 = btoa(binary);

  const assetPath = await invoke<string>("save_background_image_asset_cmd", {
    fileName: file.name,
    dataBase64: base64,
  });

  const mime = file.type || extractMimeType(file.name);
  const dataUrl = `data:${mime};base64,${base64}`;
  return { dataUrl, assetPath };
}

export async function saveAppFontFile(file: File): Promise<{
  dataUrl: string;
  assetPath: string;
  familyName: string;
}> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  const base64 = btoa(binary);

  const assetPath = await invoke<string>("save_font_asset_cmd", {
    fileName: file.name,
    dataBase64: base64,
  });

  const mime = file.type || extractFontMimeType(file.name);
  const dataUrl = `data:${mime};base64,${base64}`;
  const familyName = fontFamilyFromFileName(file.name);

  return { dataUrl, assetPath, familyName };
}

export function base64JsonToText(base64: string): string {
  return decodeBase64(base64);
}

function applyTheme(theme: ThemeName) {
  const root = document.documentElement;

  if (theme === "sky") {
    root.style.setProperty("--bg-color", "rgba(7, 21, 44, 0.72)");
    root.style.setProperty("--panel-color", "rgba(98, 186, 255, 0.09)");
    root.style.setProperty("--panel-hover", "rgba(98, 186, 255, 0.16)");
    root.style.setProperty("--border-color", "rgba(129, 200, 246, 0.82)");
    root.style.setProperty("--highlight-title-color", "#b9e6ff");
    root.style.setProperty("--text-muted", "#8db3cf");
    root.style.setProperty("--accent-blue", "#4ab6ff");
    return;
  }

  if (theme === "aurora") {
    root.style.setProperty("--bg-color", "rgba(10, 18, 22, 0.75)");
    root.style.setProperty("--panel-color", "rgba(113, 255, 206, 0.06)");
    root.style.setProperty("--panel-hover", "rgba(113, 255, 206, 0.12)");
    root.style.setProperty("--border-color", "rgba(130, 255, 160, 0.78)");
    root.style.setProperty("--highlight-title-color", "#8cf6bf");
    root.style.setProperty("--text-muted", "#85bca0");
    root.style.setProperty("--accent-blue", "#43d3ff");
    return;
  }

  root.style.removeProperty("--bg-color");
  root.style.removeProperty("--panel-color");
  root.style.removeProperty("--panel-hover");
  root.style.removeProperty("--border-color");
  root.style.removeProperty("--highlight-title-color");
  root.style.removeProperty("--text-muted");
  root.style.removeProperty("--accent-blue");
}

export function applyConfigToUI(config: AppConfig): void {
  const root = document.documentElement;

  applyTheme(config.appearance.theme);

  const r = Math.round(config.appearance.textRed * 255);
  const g = Math.round(config.appearance.textGreen * 255);
  const b = Math.round(config.appearance.textBlue * 255);
  const a = config.appearance.textOpacity.toFixed(2);
  root.style.setProperty("--text-color", `rgba(${r}, ${g}, ${b}, ${a})`);

  const fontStyleId = "focux-user-font-style";
  const existingStyle = document.getElementById(fontStyleId);
  if (config.advanced.appFontDataUrl && config.advanced.appFontFamily) {
    const css = `@font-face { font-family: "FocuxUserFont"; src: url("${config.advanced.appFontDataUrl}"); font-display: swap; }`;
    if (existingStyle) {
      existingStyle.textContent = css;
    } else {
      const style = document.createElement("style");
      style.id = fontStyleId;
      style.textContent = css;
      document.head.appendChild(style);
    }
    root.style.setProperty(
      "--font-family",
      '"FocuxUserFont", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    );
  } else {
    if (existingStyle) {
      existingStyle.remove();
    }
    root.style.removeProperty("--font-family");
  }

  const app = document.getElementById("app");
  if (app) {
    if (config.advanced.backgroundImageDataUrl) {
      app.style.setProperty(
        "--app-bg-image",
        `url(${config.advanced.backgroundImageDataUrl})`,
      );
      app.style.setProperty(
        "--app-bg-opacity",
        config.advanced.backgroundOpacity.toFixed(2),
      );
      app.style.setProperty(
        "--app-bg-blur",
        `${config.advanced.backgroundBlur}px`,
      );
    } else {
      app.style.removeProperty("--app-bg-image");
      app.style.removeProperty("--app-bg-opacity");
      app.style.removeProperty("--app-bg-blur");
    }
  }
}

export async function applyStartupResolution(config: AppConfig): Promise<void> {
  const [wRaw, hRaw] = config.appearance.startupResolution.split("x");
  const width = Number(wRaw);
  const height = Number(hRaw);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return;

  const appWindow = getCurrentWindow();
  await appWindow.setSize(new LogicalSize(width, height));
}

export function eventMatchesShortcut(
  e: KeyboardEvent,
  shortcut: string,
): boolean {
  const value = shortcut.toLowerCase().replace(/\s+/g, "");

  if (value === "ctrl+s") {
    return e.ctrlKey && !e.altKey && e.key.toLowerCase() === "s";
  }

  if (value === "alt+s") {
    return !e.ctrlKey && e.altKey && e.key.toLowerCase() === "s";
  }

  if (value === "ctrl+,") {
    return e.ctrlKey && !e.altKey && e.key === ",";
  }

  return false;
}
