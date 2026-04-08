import { LanguageCode, loadConfig } from "./config";

type MessageKey =
  | "settings.title"
  | "settings.subtitle"
  | "settings.tab.appearance"
  | "settings.tab.advanced"
  | "settings.tab.shortcut"
  | "settings.save"
  | "settings.back"
  | "settings.startupResolution"
  | "settings.textRed"
  | "settings.textGreen"
  | "settings.textBlue"
  | "settings.textOpacity"
  | "settings.theme"
  | "settings.theme.default"
  | "settings.theme.sky"
  | "settings.theme.aurora"
  | "settings.bgImage"
  | "settings.appFont"
  | "settings.bgBlur"
  | "settings.bgOpacity"
  | "settings.indexDepth"
  | "settings.indexLimit"
  | "settings.launchWithWindows"
  | "settings.openSettingsShortcut"
  | "settings.language"
  | "settings.configFile"
  | "settings.exportConfig"
  | "settings.importConfig"
  | "settings.lang.en"
  | "settings.lang.vi"
  | "shortcut.toggleLauncher"
  | "shortcut.openSettings"
  | "shortcut.moveSelection"
  | "shortcut.openSelected"
  | "shortcut.deleteClipboard"
  | "shortcut.hideLauncher"
  | "search.placeholder"
  | "search.footerGuide"
  | "search.deleteClipboard"
  | "search.noResults"
  | "search.kind"
  | "search.path"
  | "search.unknownSize"
  | "search.chars";

const messages: Record<LanguageCode, Record<MessageKey, string>> = {
  en: {
    "settings.title": "Settings",
    "settings.subtitle": "Configure appearance, indexing and shortcuts",
    "settings.tab.appearance": "Appearance",
    "settings.tab.advanced": "Advanced",
    "settings.tab.shortcut": "Shortcut",
    "settings.save": "Save config",
    "settings.back": "Back to launcher",
    "settings.startupResolution": "Startup resolution",
    "settings.textRed": "Text Red",
    "settings.textGreen": "Text Green",
    "settings.textBlue": "Text Blue",
    "settings.textOpacity": "Text Opacity",
    "settings.theme": "Theme",
    "settings.theme.default": "Default",
    "settings.theme.sky": "Sky",
    "settings.theme.aurora": "Aurora",
    "settings.bgImage": "Background image (jpg/png)",
    "settings.appFont": "App font (ttf/otf/woff/woff2)",
    "settings.bgBlur": "Background Blur",
    "settings.bgOpacity": "Background Opacity",
    "settings.indexDepth": "File scan depth",
    "settings.indexLimit": "File scan limit",
    "settings.launchWithWindows": "Launch with Windows",
    "settings.openSettingsShortcut": "Open settings shortcut",
    "settings.language": "Language",
    "settings.configFile": "Config file",
    "settings.exportConfig": "Export config",
    "settings.importConfig": "Import config",
    "settings.lang.en": "English",
    "settings.lang.vi": "Tiếng Việt",
    "shortcut.toggleLauncher": "Show or hide launcher window",
    "shortcut.openSettings": "Open settings screen from launcher",
    "shortcut.moveSelection": "Move selection up/down in result list",
    "shortcut.openSelected": "Open selected app/folder",
    "shortcut.deleteClipboard": "Delete selected clipboard item in @c mode",
    "shortcut.hideLauncher": "Hide launcher window",
    "search.placeholder": "Search...  (@d folders, @c clipboard)",
    "search.footerGuide": "Tab/Shift+Tab move • Enter open",
    "search.deleteClipboard": "Delete",
    "search.noResults": "No results found",
    "search.kind": "Kind",
    "search.path": "Path",
    "search.unknownSize": "Unknown size",
    "search.chars": "chars",
  },
  vi: {
    "settings.title": "Cài đặt",
    "settings.subtitle": "Tùy chỉnh giao diện, indexing và phím tắt",
    "settings.tab.appearance": "Giao diện",
    "settings.tab.advanced": "Nâng cao",
    "settings.tab.shortcut": "Phím tắt",
    "settings.save": "Lưu cấu hình",
    "settings.back": "Quay lại launcher",
    "settings.startupResolution": "Kích thước khi khởi động",
    "settings.textRed": "Màu chữ - Đỏ",
    "settings.textGreen": "Màu chữ - Xanh lá",
    "settings.textBlue": "Màu chữ - Xanh dương",
    "settings.textOpacity": "Độ mờ chữ",
    "settings.theme": "Chủ đề",
    "settings.theme.default": "Mặc định",
    "settings.theme.sky": "Bầu trời",
    "settings.theme.aurora": "Cực quang",
    "settings.bgImage": "Ảnh nền (jpg/png)",
    "settings.appFont": "Font chữ app (ttf/otf/woff/woff2)",
    "settings.bgBlur": "Độ mờ ảnh nền",
    "settings.bgOpacity": "Độ mờ ảnh nền",
    "settings.indexDepth": "Độ sâu quét thư mục",
    "settings.indexLimit": "Giới hạn số mục quét",
    "settings.launchWithWindows": "Khởi động cùng Windows",
    "settings.openSettingsShortcut": "Phím mở cài đặt",
    "settings.language": "Ngôn ngữ",
    "settings.configFile": "Tệp cấu hình",
    "settings.exportConfig": "Xuất cấu hình",
    "settings.importConfig": "Nhập cấu hình",
    "settings.lang.en": "English",
    "settings.lang.vi": "Tiếng Việt",
    "shortcut.toggleLauncher": "Hiện/ẩn cửa sổ launcher",
    "shortcut.openSettings": "Mở màn hình cài đặt từ launcher",
    "shortcut.moveSelection": "Di chuyển lựa chọn trong danh sách",
    "shortcut.openSelected": "Mở app/thư mục đang chọn",
    "shortcut.deleteClipboard": "Xóa mục clipboard đang chọn ở chế độ @c",
    "shortcut.hideLauncher": "Ẩn launcher",
    "search.placeholder": "Tìm kiếm...  (@d thư mục, @c clipboard)",
    "search.footerGuide": "Tab/Shift+Tab di chuyển • Enter mở",
    "search.deleteClipboard": "Xóa",
    "search.noResults": "Không có kết quả",
    "search.kind": "Loại",
    "search.path": "Đường dẫn",
    "search.unknownSize": "Không rõ dung lượng",
    "search.chars": "ký tự",
  },
};

export function getCurrentLanguage(): LanguageCode {
  return loadConfig().advanced.language;
}

export function t(
  key: MessageKey,
  lang: LanguageCode = getCurrentLanguage(),
): string {
  return messages[lang][key] ?? messages.en[key] ?? key;
}
