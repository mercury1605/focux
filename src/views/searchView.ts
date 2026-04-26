// src/views/searchView.ts
import { getCurrentWindow } from "@tauri-apps/api/window";
import Fuse from "fuse.js";
import { setupSearchBar } from "../components/searchBar";
import { debounce } from "../utils/debounce";
import {
  AppInfo,
  deleteClipboardItemFromSystem,
  fetchAppsFromSystem,
  getAppIconFromSystem,
  launchApp,
  searchClipboardFromSystem,
  searchFoldersFromSystem,
} from "../services/commands";
import { renderResultsList } from "../components/resultList";
import {
  CLIPBOARD_ICON_DATA_URI,
  CLIPBOARD_SEARCH_PREFIX,
  FOLDER_ICON_DATA_URI,
  FOLDER_SEARCH_PREFIX,
} from "../utils/constants";
import { getCurrentLanguage, t } from "../services/i18n";

const appWindow = getCurrentWindow();

// Biến lưu trữ (State) của màn hình Search
let allApps: AppInfo[] = []; // Chứa toàn bộ app lấy từ hệ thống
let filteredApps: AppInfo[] = []; // Chứa app đang hiển thị
let selectedIndex = 0; // Vị trí đang highlight
let appSearchIndex: Fuse<AppInfo> | null = null;
let searchRequestId = 0;
const iconFetchAttempted = new Set<string>();

const MAX_VISIBLE_RESULTS = 40;

function showCopyToast() {
  const existing = document.getElementById("copy-toast");
  existing?.remove();

  const toast = document.createElement("div");
  toast.id = "copy-toast";
  toast.className = "app-toast";
  toast.innerHTML = `
    <span class="app-toast-icon">✓</span>
    <span>${t("search.copySuccess", getCurrentLanguage())}</span>
  `;

  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 220);
  }, 1600);
}

async function copySelectedClipboardPreview(item: AppInfo): Promise<boolean> {
  if (item.kind !== "Clipboard") return false;

  try {
    if (item.clipboardType === "image" && item.clipboardImageDataUrl) {
      if (
        typeof ClipboardItem !== "undefined" &&
        navigator.clipboard?.write != null
      ) {
        const response = await fetch(item.clipboardImageDataUrl);
        const blob = await response.blob();
        const data: Record<string, Blob> = { [blob.type || "image/png"]: blob };
        await navigator.clipboard.write([new ClipboardItem(data)]);
      } else {
        await navigator.clipboard.writeText(item.clipboardImageDataUrl);
      }
      return true;
    }

    const text = item.clipboardText ?? "";
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function formatResultSize(sizeBytes?: number): string {
  if (sizeBytes == null || Number.isNaN(sizeBytes)) {
    return t("search.unknownSize", getCurrentLanguage());
  }

  const units = ["bytes", "KB", "MB", "GB", "TB"];
  let value = sizeBytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  if (unitIndex === 0) {
    return `${Math.round(value)} bytes`;
  }

  const rounded = Math.round(value * 10) / 10;
  const display = Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
  return `${display} ${units[unitIndex]}`;
}

function formatCharCount(charCount?: number): string {
  const safe = Math.max(0, charCount ?? 0);
  return `${safe.toLocaleString()} ${t("search.chars", getCurrentLanguage())}`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSearchIndex(apps: AppInfo[]) {
  appSearchIndex = new Fuse(apps, {
    keys: [
      { name: "name", weight: 0.8 },
      { name: "path", weight: 0.2 },
    ],
    includeScore: true,
    shouldSort: true,
    threshold: 0.35,
    ignoreLocation: true,
    findAllMatches: false,
  });
}

function searchApps(query: string): AppInfo[] {
  const q = query.trim();
  if (!q) {
    return allApps.slice(0, MAX_VISIBLE_RESULTS);
  }

  // Với query rất ngắn, ưu tiên contains để cảm giác tức thì hơn
  if (q.length < 2) {
    const lower = q.toLowerCase();
    return allApps
      .filter((app) => app.name.toLowerCase().includes(lower))
      .slice(0, MAX_VISIBLE_RESULTS);
  }

  if (!appSearchIndex) {
    return [];
  }

  return appSearchIndex
    .search(q, { limit: MAX_VISIBLE_RESULTS })
    .map((r) => r.item);
}

async function searchWithPrefix(query: string): Promise<AppInfo[]> {
  const q = query.trim();

  if (q.startsWith(CLIPBOARD_SEARCH_PREFIX)) {
    const clipboardQuery = q.slice(CLIPBOARD_SEARCH_PREFIX.length).trim();
    return searchClipboardFromSystem(clipboardQuery);
  }

  if (!q.startsWith(FOLDER_SEARCH_PREFIX)) {
    return searchApps(q);
  }

  const folderQuery = q.slice(FOLDER_SEARCH_PREFIX.length).trim();
  return searchFoldersFromSystem(folderQuery);
}

function scrollActiveResultIntoView() {
  const list = document.getElementById("results-list");
  const active = list?.querySelector(
    ".result-item.active",
  ) as HTMLElement | null;
  active?.scrollIntoView({ block: "nearest" });
}

function renderSearchResultsAndPreview() {
  const active = renderResultsList("results-list", filteredApps, selectedIndex);
  renderPreviewPane(active);
  scrollActiveResultIntoView();
  void hydrateVisibleAppIcons();
}

async function hydrateVisibleAppIcons() {
  const targets = filteredApps
    .filter((app) => app.kind === "App" && !app.icon && !!app.path)
    .filter((app) => !iconFetchAttempted.has(app.path))
    .slice(0, 10);

  if (targets.length === 0) return;

  targets.forEach((app) => iconFetchAttempted.add(app.path));

  const loaded = await Promise.all(
    targets.map(async (app) => ({
      path: app.path,
      icon: await getAppIconFromSystem(app.path),
    })),
  );

  let changed = false;
  for (const item of loaded) {
    if (!item.icon) continue;

    for (const app of allApps) {
      if (app.path === item.path && !app.icon) {
        app.icon = item.icon;
      }
    }

    for (const app of filteredApps) {
      if (app.path === item.path && !app.icon) {
        app.icon = item.icon;
        changed = true;
      }
    }
  }

  if (changed) {
    const active = renderResultsList(
      "results-list",
      filteredApps,
      selectedIndex,
    );
    renderPreviewPane(active);
    scrollActiveResultIntoView();
  }
}

function renderPreviewPane(app: AppInfo | null) {
  const preview = document.getElementById("preview-pane");
  if (!preview) return;

  if (!app) {
    preview.innerHTML = `<div class="preview-empty"></div>`;
    return;
  }

  const previewIcon =
    app.icon ||
    (app.kind === "Folder"
      ? FOLDER_ICON_DATA_URI
      : app.kind === "Clipboard"
        ? CLIPBOARD_ICON_DATA_URI
        : null);

  const iconMarkup = previewIcon
    ? `<img src="${previewIcon}" class="preview-icon" />`
    : `<div class="preview-icon" style="display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.08);border-radius:10px;">🧩</div>`;

  const metric =
    app.kind === "Clipboard"
      ? formatCharCount(app.charCount)
      : formatResultSize(app.sizeBytes);

  const clipboardPreview =
    app.kind !== "Clipboard"
      ? ""
      : app.clipboardType === "image" && app.clipboardImageDataUrl
        ? `<div class="clipboard-preview-box"><img src="${app.clipboardImageDataUrl}" class="clipboard-preview-image" /></div>`
        : `<div class="clipboard-preview-box clipboard-preview-text">${escapeHtml(app.clipboardText || "")}</div>`;

  const clipboardActions =
    app.kind === "Clipboard"
      ? `<button id="clipboard-delete-btn" class="clipboard-delete-btn" type="button" title="Delete clipboard item (Ctrl+D)">${t("search.deleteClipboard", getCurrentLanguage())}</button>`
      : "";

  preview.innerHTML = `
    <div class="preview-header">
      ${iconMarkup}
      <div>
        <div class="preview-title">${app.name}</div>
        <div class="preview-meta">
          <span class="preview-pill">${app.kind}</span>
          <span class="preview-bytes">${metric}</span>
        </div>
      </div>
      ${clipboardActions}
    </div>

    <div class="preview-grid">
      <div class="preview-label">${t("search.kind", getCurrentLanguage())}</div>
      <div class="preview-value">${app.kind}</div>

      <div class="preview-label">${t("search.path", getCurrentLanguage())}</div>
      <div class="preview-value">${app.path}</div>
    </div>

    ${clipboardPreview}
  `;

  if (app.kind === "Clipboard" && app.entryId) {
    const deleteButton = document.getElementById("clipboard-delete-btn");
    deleteButton?.addEventListener("click", async () => {
      const ok = await deleteClipboardItemFromSystem(app.entryId!);
      if (!ok) return;

      filteredApps = filteredApps.filter((x) => x.entryId !== app.entryId);
      if (selectedIndex >= filteredApps.length) {
        selectedIndex = Math.max(0, filteredApps.length - 1);
      }
      renderSearchResultsAndPreview();
    });
  }
}

export function getSearchView(): string {
  const lang = getCurrentLanguage();

  return `
    <div id="app"> <div class="search-container">
          <input type="text" id="search-bar" placeholder="${t("search.placeholder", lang)}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" autofocus />
      </div>
      <div class="content-container">
          <div id="results-list" class="results-list"></div>
          <div id="preview-pane" class="preview-pane"></div>
      </div>
      <div class="footer">
          <div>${t("search.footerGuide", lang)}</div>
      </div>
      <div class="footer-credit">made by mercury</div>
    </div>
  `;
}

// Hàm này CHỈ được gọi SAU KHI HTML ở trên đã nằm trong màn hình
export async function initSearchLogic(_navigate: (path: any) => void) {
  // Lúc này getElementById chắc chắn sẽ tìm thấy
  const searchInput = document.getElementById("search-bar") as HTMLInputElement;
  searchInput.setAttribute("autocomplete", "off");
  searchInput.setAttribute("autocorrect", "off");
  searchInput.setAttribute("autocapitalize", "off");
  searchInput.setAttribute("spellcheck", "false");
  searchInput.setAttribute("name", "focux-search");

  // 1. Tải dữ liệu ngầm từ Rust ngay khi màn hình khởi tạo
  console.log("Scanning system apps...");
  allApps = await fetchAppsFromSystem();
  buildSearchIndex(allApps);
  filteredApps = allApps.slice(0, MAX_VISIBLE_RESULTS);
  renderSearchResultsAndPreview();

  // --- THÊM HÀM RESET TRẠNG THÁI UI Ở ĐÂY ---
  const resetSearchUI = () => {
    searchInput.value = ""; // Xóa chữ trên thanh search
    filteredApps = allApps.slice(0, MAX_VISIBLE_RESULTS); // Trả lại danh sách mặc định
    selectedIndex = 0; // Đưa highlight về mục trên cùng
    renderSearchResultsAndPreview();
  };

  // 2. Xử lý gõ phím tìm kiếm
  let pendingFrame: number | null = null;
  const handleSearch = debounce((query: string) => {
    const requestId = ++searchRequestId;

    if (pendingFrame !== null) {
      cancelAnimationFrame(pendingFrame);
    }

    pendingFrame = requestAnimationFrame(async () => {
      const results = await searchWithPrefix(query);
      if (requestId !== searchRequestId) {
        pendingFrame = null;
        return;
      }

      filteredApps = results;
      selectedIndex = 0;
      renderSearchResultsAndPreview();
      pendingFrame = null;
    });
  }, 35);

  setupSearchBar(searchInput, handleSearch);

  // LẮNG NGHE ĐIỀU HƯỚNG BÀN PHÍM
  searchInput.addEventListener("keydown", async (e) => {
    const selected = filteredApps[selectedIndex];

    if (
      e.ctrlKey &&
      e.key.toLowerCase() === "c" &&
      selected?.kind === "Clipboard"
    ) {
      e.preventDefault();
      const ok = await copySelectedClipboardPreview(selected);
      if (ok) {
        showCopyToast();
      }
      return;
    }

    if (
      e.ctrlKey &&
      e.key.toLowerCase() === "d" &&
      selected?.kind === "Clipboard"
    ) {
      e.preventDefault();
      if (!selected.entryId) return;

      const ok = await deleteClipboardItemFromSystem(selected.entryId);
      if (!ok) return;

      filteredApps = filteredApps.filter((x) => x.entryId !== selected.entryId);
      if (selectedIndex >= filteredApps.length) {
        selectedIndex = Math.max(0, filteredApps.length - 1);
      }
      renderSearchResultsAndPreview();
      return;
    }

    const total = filteredApps.length;
    if (total === 0) return;

    if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      // Logic vòng tròn: (0 -> 1 -> 2 -> 0)
      selectedIndex = (selectedIndex + 1) % total;
      renderSearchResultsAndPreview();
    } else if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
      e.preventDefault();
      // Logic vòng tròn ngược: (0 -> 2 -> 1 -> 0)
      selectedIndex = (selectedIndex - 1 + total) % total;
      renderSearchResultsAndPreview();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selectedApp = filteredApps[selectedIndex];
      if (selectedApp) {
        if (selectedApp.kind === "Clipboard") {
          return;
        }

        await launchApp(selectedApp.path);
        searchInput.value = "";
        resetSearchUI();
        await appWindow.hide();
      }
    } else if (e.key === "Escape") {
      resetSearchUI();
      await appWindow.hide();
    }
  });

  // Xử lý phím Escape
  searchInput.addEventListener("keydown", async (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      searchInput.value = "";
      await appWindow.hide();
    }
  });
}
