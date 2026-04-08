// src/views/settingsView.ts
import {
  AppConfig,
  applyConfigToUI,
  exportConfigJson,
  importConfigJson,
  loadConfig,
  saveAppFontFile,
  saveBackgroundImageFile,
  saveConfig,
} from "../services/config";
import { t } from "../services/i18n";
import {
  getLaunchWithWindows,
  setFolderIndexOptions,
  setLaunchWithWindows,
} from "../services/commands";

function sliderRow(
  label: string,
  id: string,
  value: number,
  min = 0,
  max = 1,
  step = 0.01,
) {
  return `
    <div class="settings-row">
      <label for="${id}">${label}</label>
      <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" />
      <span id="${id}-value" class="settings-value">${Number(value).toFixed(2)}</span>
    </div>
  `;
}

export function getSettingsView(): string {
  const cfg = loadConfig();
  const lang = cfg.advanced.language;

  return `
    <div id="app" class="settings-root">
      <div class="settings-header">
        <div>
          <div class="settings-title">${t("settings.title", lang)}</div>
          <div class="settings-subtitle">${t("settings.subtitle", lang)}</div>
        </div>
        <div class="settings-actions-top">
          <button id="settings-save-btn" class="settings-action-btn primary">${t("settings.save", lang)}</button>
          <button id="settings-back-btn" class="settings-action-btn">${t("settings.back", lang)}</button>
        </div>
      </div>

      <div class="settings-tabs">
        <button class="settings-tab active" data-tab="appearance">${t("settings.tab.appearance", lang)}</button>
        <button class="settings-tab" data-tab="advanced">${t("settings.tab.advanced", lang)}</button>
        <button class="settings-tab" data-tab="shortcut">${t("settings.tab.shortcut", lang)}</button>
      </div>

      <div class="settings-panel active" id="settings-tab-appearance">
        ${sliderRow(t("settings.textRed", lang), "text-red", cfg.appearance.textRed)}
        ${sliderRow(t("settings.textGreen", lang), "text-green", cfg.appearance.textGreen)}
        ${sliderRow(t("settings.textBlue", lang), "text-blue", cfg.appearance.textBlue)}
        ${sliderRow(t("settings.textOpacity", lang), "text-opacity", cfg.appearance.textOpacity)}

        <div class="settings-row">
          <label for="theme-select">${t("settings.theme", lang)}</label>
          <select id="theme-select">
            <option value="default" ${cfg.appearance.theme === "default" ? "selected" : ""}>${t("settings.theme.default", lang)}</option>
            <option value="sky" ${cfg.appearance.theme === "sky" ? "selected" : ""}>${t("settings.theme.sky", lang)}</option>
            <option value="aurora" ${cfg.appearance.theme === "aurora" ? "selected" : ""}>${t("settings.theme.aurora", lang)}</option>
          </select>
        </div>
      </div>

      <div class="settings-panel" id="settings-tab-advanced">
        <div class="settings-row">
          <label for="bg-image-file">${t("settings.bgImage", lang)}</label>
          <input id="bg-image-file" type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" />
        </div>

        <div class="settings-row">
          <label for="app-font-file">${t("settings.appFont", lang)}</label>
          <input id="app-font-file" type="file" accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2" />
        </div>

        <div class="settings-row settings-actions-row">
          <label>${t("settings.configFile", lang)}</label>
          <div class="settings-inline-actions">
            <button id="export-config-btn" class="settings-action-btn" type="button">${t("settings.exportConfig", lang)}</button>
            <label for="import-config-file" class="settings-action-btn">${t("settings.importConfig", lang)}</label>
            <input id="import-config-file" type="file" accept=".json,application/json" class="settings-import-hidden" />
          </div>
          <span></span>
        </div>

        ${sliderRow(t("settings.bgBlur", lang), "bg-blur", cfg.advanced.backgroundBlur, 0, 40, 1)}
        ${sliderRow(t("settings.bgOpacity", lang), "bg-opacity", cfg.advanced.backgroundOpacity)}

        <div class="settings-row">
          <label for="index-depth">${t("settings.indexDepth", lang)}</label>
          <input id="index-depth" type="number" min="1" max="20" step="1" value="${cfg.advanced.indexDepth}" />
        </div>

        <div class="settings-row">
          <label for="index-limit">${t("settings.indexLimit", lang)}</label>
          <input id="index-limit" type="number" min="2000" max="200000" step="1000" value="${cfg.advanced.indexLimit}" />
        </div>

        <div class="settings-row">
          <label for="language-select">${t("settings.language", lang)}</label>
          <select id="language-select">
            <option value="en" ${cfg.advanced.language === "en" ? "selected" : ""}>${t("settings.lang.en", lang)}</option>
            <option value="vi" ${cfg.advanced.language === "vi" ? "selected" : ""}>${t("settings.lang.vi", lang)}</option>
          </select>
        </div>

        <div class="settings-row settings-checkbox-row">
          <label for="launch-with-windows">${t("settings.launchWithWindows", lang)}</label>
          <input id="launch-with-windows" type="checkbox" ${cfg.advanced.launchWithWindows ? "checked" : ""} />
        </div>

        <div class="settings-row">
          <label for="open-settings-shortcut">${t("settings.openSettingsShortcut", lang)}</label>
          <select id="open-settings-shortcut">
            <option value="Ctrl+S" ${cfg.shortcut.openSettingsShortcut === "Ctrl+S" ? "selected" : ""}>Ctrl + S</option>
            <option value="Alt+S" ${cfg.shortcut.openSettingsShortcut === "Alt+S" ? "selected" : ""}>Alt + S</option>
            <option value="Ctrl+," ${cfg.shortcut.openSettingsShortcut === "Ctrl+," ? "selected" : ""}>Ctrl + ,</option>
          </select>
        </div>
      </div>

      <div class="settings-panel" id="settings-tab-shortcut">
        <div class="shortcut-guide-item">
          <div class="shortcut-key">Alt + Space</div>
          <div class="shortcut-desc">${t("shortcut.toggleLauncher", lang)}</div>
        </div>
        <div class="shortcut-guide-item">
          <div class="shortcut-key">${cfg.shortcut.openSettingsShortcut}</div>
          <div class="shortcut-desc">${t("shortcut.openSettings", lang)}</div>
        </div>
        <div class="shortcut-guide-item">
          <div class="shortcut-key">Tab / Shift + Tab</div>
          <div class="shortcut-desc">${t("shortcut.moveSelection", lang)}</div>
        </div>
        <div class="shortcut-guide-item">
          <div class="shortcut-key">Enter</div>
          <div class="shortcut-desc">${t("shortcut.openSelected", lang)}</div>
        </div>
        <div class="shortcut-guide-item">
          <div class="shortcut-key">Ctrl + D</div>
          <div class="shortcut-desc">${t("shortcut.deleteClipboard", lang)}</div>
        </div>
        <div class="shortcut-guide-item">
          <div class="shortcut-key">Esc</div>
          <div class="shortcut-desc">${t("shortcut.hideLauncher", lang)}</div>
        </div>
      </div>

    </div>
  `;
}

function getNumberInputValue(id: string, fallback: number): number {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (!el) return fallback;
  const v = Number(el.value);
  return Number.isFinite(v) ? v : fallback;
}

function getRangeInputValue(id: string, fallback: number): number {
  return getNumberInputValue(id, fallback);
}

function getThemeTextPreset(theme: AppConfig["appearance"]["theme"]) {
  if (theme === "sky") {
    return { r: 0.73, g: 0.9, b: 1.0, a: 1.0 };
  }

  if (theme === "aurora") {
    return { r: 0.74, g: 0.96, b: 0.86, a: 1.0 };
  }

  return { r: 0.84, g: 0.91, b: 0.8, a: 1.0 };
}

function setSliderValue(id: string, value: number) {
  const input = document.getElementById(id) as HTMLInputElement | null;
  const valueEl = document.getElementById(`${id}-value`);
  if (!input) return;
  input.value = String(value);
  if (valueEl) {
    valueEl.textContent = Number(value).toFixed(2);
  }
}

function collectConfigFromForm(previous: AppConfig): AppConfig {
  const theme =
    ((document.getElementById("theme-select") as HTMLSelectElement | null)
      ?.value as AppConfig["appearance"]["theme"]) ?? previous.appearance.theme;

  const openSettingsShortcut =
    (
      document.getElementById(
        "open-settings-shortcut",
      ) as HTMLSelectElement | null
    )?.value ?? previous.shortcut.openSettingsShortcut;

  const language =
    ((document.getElementById("language-select") as HTMLSelectElement | null)
      ?.value as AppConfig["advanced"]["language"]) ??
    previous.advanced.language;

  return {
    appearance: {
      startupResolution: previous.appearance.startupResolution,
      textRed: getRangeInputValue("text-red", previous.appearance.textRed),
      textGreen: getRangeInputValue(
        "text-green",
        previous.appearance.textGreen,
      ),
      textBlue: getRangeInputValue("text-blue", previous.appearance.textBlue),
      textOpacity: getRangeInputValue(
        "text-opacity",
        previous.appearance.textOpacity,
      ),
      theme,
    },
    advanced: {
      backgroundImageDataUrl: previous.advanced.backgroundImageDataUrl,
      backgroundImageAsset: previous.advanced.backgroundImageAsset,
      appFontDataUrl: previous.advanced.appFontDataUrl,
      appFontAsset: previous.advanced.appFontAsset,
      appFontFamily: previous.advanced.appFontFamily,
      backgroundBlur: getRangeInputValue(
        "bg-blur",
        previous.advanced.backgroundBlur,
      ),
      backgroundOpacity: getRangeInputValue(
        "bg-opacity",
        previous.advanced.backgroundOpacity,
      ),
      indexDepth: getNumberInputValue(
        "index-depth",
        previous.advanced.indexDepth,
      ),
      indexLimit: getNumberInputValue(
        "index-limit",
        previous.advanced.indexLimit,
      ),
      language,
      launchWithWindows:
        (
          document.getElementById(
            "launch-with-windows",
          ) as HTMLInputElement | null
        )?.checked ?? previous.advanced.launchWithWindows,
    },
    shortcut: {
      openSettingsShortcut,
    },
  };
}

export function initSettingsLogic(
  navigate: (view: "search" | "settings") => void,
) {
  let working = loadConfig();

  const applyLivePreviewFromForm = () => {
    working = collectConfigFromForm(working);
    applyConfigToUI(working);
  };

  void (async () => {
    const isEnabled = await getLaunchWithWindows();
    working = {
      ...working,
      advanced: {
        ...working.advanced,
        launchWithWindows: isEnabled,
      },
    };

    const launchCheckbox = document.getElementById(
      "launch-with-windows",
    ) as HTMLInputElement | null;
    if (launchCheckbox) {
      launchCheckbox.checked = isEnabled;
    }
  })();

  const tabButtons = Array.from(document.querySelectorAll(".settings-tab"));
  const tabPanels = Array.from(document.querySelectorAll(".settings-panel"));

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = (btn as HTMLElement).dataset.tab;
      tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      tabPanels.forEach((panel) => {
        panel.classList.toggle("active", panel.id === `settings-tab-${tab}`);
      });
    });
  });

  [
    "text-red",
    "text-green",
    "text-blue",
    "text-opacity",
    "bg-blur",
    "bg-opacity",
  ].forEach((id) => {
    const input = document.getElementById(id) as HTMLInputElement | null;
    const valueEl = document.getElementById(`${id}-value`);
    input?.addEventListener("input", () => {
      if (valueEl) valueEl.textContent = Number(input.value).toFixed(2);
      applyLivePreviewFromForm();
    });
  });

  ["theme-select"].forEach((id) => {
    const input = document.getElementById(id) as HTMLInputElement | null;
    input?.addEventListener("change", () => {
      const theme = (input.value ||
        "default") as AppConfig["appearance"]["theme"];
      const preset = getThemeTextPreset(theme);

      setSliderValue("text-red", preset.r);
      setSliderValue("text-green", preset.g);
      setSliderValue("text-blue", preset.b);
      setSliderValue("text-opacity", preset.a);

      applyLivePreviewFromForm();
    });
  });

  const languageSelect = document.getElementById(
    "language-select",
  ) as HTMLSelectElement | null;
  languageSelect?.addEventListener("change", async () => {
    working = collectConfigFromForm(working);
    await saveConfig(working);
    navigate("settings");
  });

  const imageInput = document.getElementById(
    "bg-image-file",
  ) as HTMLInputElement | null;
  imageInput?.addEventListener("change", () => {
    const file = imageInput.files?.[0];
    if (!file) return;

    void (async () => {
      const { dataUrl, assetPath } = await saveBackgroundImageFile(file);
      working = {
        ...working,
        advanced: {
          ...working.advanced,
          backgroundImageDataUrl: dataUrl,
          backgroundImageAsset: assetPath,
        },
      };
      applyConfigToUI(working);
    })();
  });

  const fontInput = document.getElementById(
    "app-font-file",
  ) as HTMLInputElement | null;
  fontInput?.addEventListener("change", () => {
    const file = fontInput.files?.[0];
    if (!file) return;

    void (async () => {
      const { dataUrl, assetPath, familyName } = await saveAppFontFile(file);
      working = {
        ...working,
        advanced: {
          ...working.advanced,
          appFontDataUrl: dataUrl,
          appFontAsset: assetPath,
          appFontFamily: familyName,
        },
      };
      applyConfigToUI(working);
    })();
  });

  document
    .getElementById("export-config-btn")
    ?.addEventListener("click", () => {
      const json = exportConfigJson();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "focux.config.json";
      a.click();
      URL.revokeObjectURL(url);
    });

  const importInput = document.getElementById(
    "import-config-file",
  ) as HTMLInputElement | null;
  importInput?.addEventListener("change", () => {
    const file = importInput.files?.[0];
    if (!file) return;

    void (async () => {
      const text = await file.text();
      working = await importConfigJson(text);
      applyConfigToUI(working);
      navigate("settings");
    })();
  });

  document
    .getElementById("settings-save-btn")
    ?.addEventListener("click", async () => {
      working = collectConfigFromForm(working);
      await saveConfig(working);
      applyConfigToUI(working);
      await setFolderIndexOptions(
        working.advanced.indexDepth,
        working.advanced.indexLimit,
      );
      const applied = await setLaunchWithWindows(
        working.advanced.launchWithWindows,
      );
      working = {
        ...working,
        advanced: {
          ...working.advanced,
          launchWithWindows: applied,
        },
      };
      await saveConfig(working);
    });

  document
    .getElementById("settings-back-btn")
    ?.addEventListener("click", () => {
      navigate("search");
    });
}
