# HeavyScope

Local-first multi-quota monitoring panel for SuperGrok Heavy and Cursor Ultra.

The same React UI runs as a web app and inside a Tauri 2 desktop shell. Quota data stays local. There is no HeavyScope cloud account.

## Features

- Four preset pools plus custom services
- Manual usage recording
- Dashboard, advisor, charts, history, and settings
- Desktop tray / macOS menu-bar shell (Tauri 2)

## Stack

- Vite + React + TypeScript, Tailwind, shadcn/ui, Recharts
- react-i18next (zh-CN, en)
- sql.js SQLite (web and Tauri webview)
- Tauri 2 tray shell in src-tauri

## Develop

Requires Node.js 22 and the package manager in package.json.

Scripts: install, dev, build, preview.

## Desktop

src-tauri wraps the existing Vite React app.
Click the tray icon to open the window.
Close hides to tray. Use Quit to exit.

Run the package.json tauri script with the dev or build subcommand.

pnpm tauri dev
pnpm tauri build

macOS menu-bar binaries must be built on a Mac.
Identifier is com.heavyscope.app. Product name is HeavyScope.

## Language

Repository docs and source comments are English. UI strings live in src/i18n/locales/.

## Privacy

The database is a sql.js file encoded in localStorage under heavyscope.sqlite.v1. Reset it from Settings.
