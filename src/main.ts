// src/main.ts
import "./styles/main.css";
import "./styles/search.css";
import "./styles/content.css";
import "./styles/footer.css";
import "./styles/settings.css";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  WINDOW_RESIZABLE,
  SEARCH_BAR_HEIGHT,
  RESULTS_WIDTH_PERCENT,
  PREVIEW_WIDTH_PERCENT,
} from "./utils/constants";
import { getSearchView, initSearchLogic } from "./views/searchView";
import { getSettingsView, initSettingsLogic } from "./views/settingsView";
import {
  applyConfigToUI,
  applyStartupResolution,
  eventMatchesShortcut,
  initConfigStorage,
  loadConfig,
} from "./services/config";
import {
  setFolderIndexOptions,
  setLaunchWithWindows,
} from "./services/commands";

const appWindow = getCurrentWindow();
// Chỉ lấy container duy nhất còn tồn tại trong index.html
const appContainer = document.getElementById("app-container") as HTMLElement;
let currentView: "search" | "settings" = "search";

// --- 1. SETUP CSS VARIABLES ---
appWindow.show(); // TẠM THỜI BẬT LÊN ĐỂ CODE UI
void appWindow.setResizable(WINDOW_RESIZABLE);

// Set CSS variables thẳng vào appContainer (hoặc document.documentElement)
appContainer.style.setProperty("--search-bar-height", `${SEARCH_BAR_HEIGHT}px`);
appContainer.style.setProperty(
  "--results-width-percent",
  `${RESULTS_WIDTH_PERCENT}%`,
);
appContainer.style.setProperty(
  "--preview-width-percent",
  `${PREVIEW_WIDTH_PERCENT}%`,
);

// --- 2. SETUP ROUTER (CHUYỂN TRANG) ---
export function navigateTo(view: "search" | "settings") {
  currentView = view;
  if (view === "search") {
    appContainer.innerHTML = getSearchView();
    applyConfigToUI(loadConfig());
    // Báo cho searchView biết là HTML đã load xong, có thể bắt sự kiện được rồi
    initSearchLogic(navigateTo);
  } else if (view === "settings") {
    appContainer.innerHTML = getSettingsView();
    applyConfigToUI(loadConfig());
    initSettingsLogic(navigateTo);
  }
}

document.addEventListener("keydown", (e) => {
  const cfg = loadConfig();
  if (eventMatchesShortcut(e, cfg.shortcut.openSettingsShortcut)) {
    e.preventDefault();
    if (currentView !== "settings") {
      navigateTo("settings");
    }
  }
});

// --- 3. GLOBAL WINDOW FOCUS LOGIC ---
appWindow.onFocusChanged(async ({ payload: focused }) => {
  if (focused) {
    // Khi app hiện lên, tìm xem có thanh search không thì focus vào
    const searchInput = document.getElementById(
      "search-bar",
    ) as HTMLInputElement | null;
    if (searchInput) searchInput.focus();
  } else {
    // KHI NÀO CODE XONG UI THÌ BỎ COMMENT DÒNG NÀY ĐỂ APP ẨN ĐI
    // await appWindow.hide();
  }
});

// --- 4. KHỞI ĐỘNG APP ---
async function bootstrap() {
  // Always render UI first to avoid blank screen when optional startup steps fail.
  navigateTo("search");

  try {
    const cfg = await initConfigStorage();
    applyConfigToUI(cfg);

    try {
      await applyStartupResolution(cfg);
    } catch (e) {
      console.warn("Failed to apply startup resolution:", e);
    }

    try {
      await setFolderIndexOptions(
        cfg.advanced.indexDepth,
        cfg.advanced.indexLimit,
      );
    } catch (e) {
      console.warn("Failed to apply folder index options:", e);
    }

    try {
      await setLaunchWithWindows(cfg.advanced.launchWithWindows);
    } catch (e) {
      console.warn("Failed to apply launch-with-windows:", e);
    }
  } catch (e) {
    console.error("Bootstrap failed:", e);
  }
}

void bootstrap();
