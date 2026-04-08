// src/components/resultsList.ts
import { AppInfo } from "../services/commands";
import {
  CLIPBOARD_ICON_DATA_URI,
  FOLDER_ICON_DATA_URI,
} from "../utils/constants";
import { getCurrentLanguage, t } from "../services/i18n";

function formatDisplayPath(fullPath: string): string {
  const normalized = fullPath.replace(/\\/g, "/").replace(/\/+/g, "/");
  const parts = normalized.split("/").filter(Boolean);

  // Parent path only (exclude current folder name)
  const parentParts = parts.slice(0, -1);

  if (parentParts.length === 0) {
    return normalized;
  }

  // Keep full parent path for shallow hierarchy (<= 3 parent levels)
  if (parentParts.length <= 3) {
    // Restore leading slash for absolute Unix-like paths
    if (normalized.startsWith("/")) {
      return `/${parentParts.join("/")}`;
    }
    return parentParts.join("/");
  }

  // Deep parent path: show only last 3 parent levels with ellipsis
  return `.../${parentParts.slice(-3).join("/")}`;
}

export function renderResultsList(
  containerId: string,
  apps: AppInfo[],
  selectedIndex: number = 0,
): AppInfo | null {
  const container = document.getElementById(containerId);
  if (!container) return null;

  if (apps.length === 0) {
    container.innerHTML = `<div class="preview-empty" style="padding: 15px;">${t("search.noResults", getCurrentLanguage())}</div>`;
    return null;
  }

  const html = apps
    .map((app, index) => {
      const isActive = index === selectedIndex ? "active" : "";

      const folderIcon = app.kind === "Folder" ? FOLDER_ICON_DATA_URI : null;
      const clipboardIcon =
        app.kind === "Clipboard" ? CLIPBOARD_ICON_DATA_URI : null;

      const iconMarkup =
        app.icon || folderIcon || clipboardIcon
          ? `<img src="${app.icon || folderIcon || clipboardIcon}" class="result-icon" />`
          : `<div class="result-icon" style="display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.08);border-radius:8px;">🧩</div>`;

      const metaMarkup =
        app.kind === "Folder"
          ? `<div class="result-meta">
               <span class="result-kind">${app.kind}</span>
               <span class="result-dot">•</span>
               <span class="result-path">${formatDisplayPath(app.path)}</span>
             </div>`
          : `<div class="result-kind">${app.kind}</div>`;

      return `
      <div class="result-item ${isActive}">
        ${iconMarkup}
        <div>
          <div class="result-title">${app.name}</div>
          ${metaMarkup}
        </div>
      </div>
    `;
    })
    .join("");

  container.innerHTML = html;
  return apps[selectedIndex] ?? null;
}
