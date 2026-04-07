// src/components/resultsList.ts
import { AppInfo } from "../services/commands";

export function renderResultsList(
  containerId: string,
  apps: AppInfo[],
  selectedIndex: number = 0,
): AppInfo | null {
  const container = document.getElementById(containerId);
  if (!container) return null;

  if (apps.length === 0) {
    container.innerHTML = `<div class="preview-empty" style="padding: 15px;">No results found</div>`;
    return null;
  }

  const html = apps
    .map((app, index) => {
      const isActive = index === selectedIndex ? "active" : "";

      const iconMarkup = app.icon
        ? `<img src="${app.icon}" class="result-icon" />`
        : `<div class="result-icon" style="display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.08);border-radius:8px;">🧩</div>`;

      return `
      <div class="result-item ${isActive}">
        ${iconMarkup}
        <div>
          <div class="result-title">${app.name}</div>
          <div class="result-kind">${app.kind}</div>
        </div>
      </div>
    `;
    })
    .join("");

  container.innerHTML = html;
  return apps[selectedIndex] ?? null;
}
