# Focux

Focux is a keyboard-first desktop launcher built with Tauri 2, Rust, TypeScript, and Vite.

It focuses on fast local search, modern glass-style UI, and practical daily workflows (apps, folders, clipboard, and settings).

## Current Features

- App search with fuzzy matching
- Folder mode with `@d` prefix
  - Background indexing
  - Ranking by name relevance + modified time
- Clipboard mode with `@c` prefix
  - Text/image preview
  - Delete item with button or `Ctrl + D`
- Windows icon extraction with cache and shortcut target resolution (`.lnk`)
- Settings screen with 3 tabs
  - Appearance: text color controls + theme
  - Advanced: background image, app font, indexing limits, language, launch with Windows, config import/export
  - Shortcut: key guide
- Language support: English / Vietnamese
- Local app storage for user assets and config
  - Config JSON stored in app data
  - Uploaded background/font files copied into app asset folders

## Tech Stack

- Tauri 2
- Rust (backend commands, indexing, clipboard, storage)
- TypeScript (UI logic)
- Vite
- CSS (custom UI styling)

## Run Locally

Prerequisites:

- Node.js 18+
- Rust stable
- Tauri prerequisites for your OS

Development:

1. `npm install`
2. `npm run tauri dev`

Build:

1. `npm run build`
2. `npm run tauri build`

## Keyboard Shortcuts

- `Alt + Space`: show/hide launcher
- `Ctrl + S` (default): open settings (customizable in app)
- `Tab` / `Shift + Tab`: move selection
- `Enter`: open selected app/folder
- `Ctrl + D`: delete selected clipboard item in `@c`
- `Esc`: hide launcher

## Project Structure

```text
focux/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── lib.rs
│       ├── commands/
│       └── system/
├── src/
│   ├── main.ts
│   ├── views/
│   ├── components/
│   ├── services/
│   ├── styles/
│   └── utils/
├── index.html
├── package.json
└── vite.config.ts
```

## Notes

- User config and copied assets are stored under app data directory (`com.nguyen.focux`).
- Build artifacts and generated files are excluded by `.gitignore`.
