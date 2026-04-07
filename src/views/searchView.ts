// src/views/searchView.ts
import { getCurrentWindow } from "@tauri-apps/api/window";
import Fuse from "fuse.js";
import { setupSearchBar } from "../components/searchBar";
import { debounce } from "../utils/debounce";
import { AppInfo, fetchAppsFromSystem, launchApp } from "../services/commands";
import { renderResultsList } from "../components/resultList";

const appWindow = getCurrentWindow();

// Biến lưu trữ (State) của màn hình Search
let allApps: AppInfo[] = []; // Chứa toàn bộ app lấy từ hệ thống
let filteredApps: AppInfo[] = []; // Chứa app đang hiển thị
let selectedIndex = 0; // Vị trí đang highlight
let appSearchIndex: Fuse<AppInfo> | null = null;

const MAX_VISIBLE_RESULTS = 40;

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
}

function renderPreviewPane(app: AppInfo | null) {
  const preview = document.getElementById("preview-pane");
  if (!preview) return;

  if (!app) {
    preview.innerHTML = `<div class="preview-empty"></div>`;
    return;
  }

  const iconMarkup = app.icon
    ? `<img src="${app.icon}" class="preview-icon" />`
    : `<div class="preview-icon" style="display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.08);border-radius:10px;">🧩</div>`;

  preview.innerHTML = `
    <div class="preview-header">
      ${iconMarkup}
      <div>
        <div class="preview-title">${app.name}</div>
        <div class="preview-meta">
          <span class="preview-pill">${app.kind}</span>
          <span class="preview-bytes">ready</span>
        </div>
      </div>
    </div>

    <div class="preview-grid">
      <div class="preview-label">Kind</div>
      <div class="preview-value">${app.kind}</div>

      <div class="preview-label">Path</div>
      <div class="preview-value">${app.path}</div>
    </div>
  `;
}

export function getSearchView(): string {
  return `
    <div id="app"> <div class="search-container">
          <input type="text" id="search-bar" placeholder="Search apps..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" autofocus />
      </div>
      <div class="content-container">
          <div id="results-list" class="results-list"></div>
          <div id="preview-pane" class="preview-pane"></div>
      </div>
      <div class="footer">
          <div><b>Tab/Shift+Tab</b> move &nbsp; • &nbsp; <b>Enter</b> open &nbsp;</div>
      </div>
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
    if (pendingFrame !== null) {
      cancelAnimationFrame(pendingFrame);
    }

    pendingFrame = requestAnimationFrame(() => {
      filteredApps = searchApps(query);
      selectedIndex = 0; // Reset vị trí chọn về đầu tiên
      renderSearchResultsAndPreview();
      pendingFrame = null;
    });
  }, 35);

  setupSearchBar(searchInput, handleSearch);

  // LẮNG NGHE ĐIỀU HƯỚNG BÀN PHÍM
  searchInput.addEventListener("keydown", async (e) => {
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
