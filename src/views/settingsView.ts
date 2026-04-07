// src/views/settingsView.ts
export function getSettingsView(): string {
  return `
    <div class="view-settings" style="padding: 20px; color: white;">
      <h2>Focux Settings</h2>
      <div class="setting-item">
        <label>Launch shortcut:</label>
        <input type="text" value="Alt + Space" disabled />
      </div>
      <button id="btn-back" style="margin-top: 20px;">⬅ Back</button>
    </div>
  `;
}

// Sửa đổi dòng này
export function initSettingsLogic(
  navigate: (view: "search" | "settings") => void,
) {
  document.getElementById("btn-back")?.addEventListener("click", () => {
    navigate("search");
  });
}
