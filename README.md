# Focux

Focux is a desktop launcher built with Tauri, Rust, TypeScript, and Vite.

It scans installed apps, supports keyboard-first navigation, and provides a clean glass-style UI.

## Project Status

⚠️ This repository is **still under active development**. Features, structure, and APIs may change.

## Tech Stack

- Tauri 2 (desktop shell)
- Rust (system commands and app scanning)
- TypeScript (UI logic)
- Vite (frontend tooling)

## Quick Start

Prerequisites:

- Node.js 18+
- Rust toolchain (stable)
- Tauri prerequisites for your OS

Install and run:

1. `npm install`
2. `npm run tauri dev`

Build production app:

1. `npm run build`
2. `npm run tauri build`

## Folder Structure

focux/
├── src-tauri/ # Rust + Tauri backend
│ ├── Cargo.toml
│ ├── tauri.conf.json
│ └── src/
│ ├── lib.rs # Tauri setup / commands registration
│ ├── commands/ # Invokable commands from frontend
│ ├── system/ # App scanning / icon extraction / OS logic
│ └── utils/
├── src/ # Frontend (TypeScript + CSS)
│ ├── main.ts
│ ├── views/
│ ├── components/
│ ├── services/
│ ├── utils/
│ └── styles/
├── index.html
├── package.json
└── vite.config.ts

## Notes

- Window behavior and UI constants are configured in frontend constants and Tauri config.
- Generated artifacts are excluded via .gitignore (node_modules, dist, and Tauri/Rust build output).
