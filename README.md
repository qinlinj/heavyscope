# HeavyScope

Local-first multi-quota monitoring panel for SuperGrok Heavy and Cursor Ultra.

The same React UI runs as a web app and inside a Tauri 2 desktop shell. Quota data stays local. There is no HeavyScope cloud account.

## Features

- Four preset pools plus custom services
- Manual usage recording
- Dashboard, advisor, charts, history, and settings
- Desktop tray / macOS menu-bar shell (Tauri 2)
- Cursor usage snapshot import and optional auto-sync

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

## Data sources

Manual entry is the source of truth. Adapters never scrape Cursor or Grok credentials, cookies, or private APIs.

### Cursor snapshot format

Paste JSON or a simple CSV in Settings → Data sources. This Linux/web build cannot read the Cursor app database. Provide an export you created yourself. HeavyScope does not invent live quota numbers.

JSON:

```json
{
  "source": "cursor",
  "fetchedAt": "2026-08-18T10:00:00.000Z",
  "pools": [
    { "hint": "cursor_models", "used": 12, "total": 500 },
    { "hint": "cursor_other", "used": 40.5, "total": 400 }
  ]
}
```

`hint` values: `grok_heavy`, `grok_bot`, `cursor_models`, `cursor_other`, or `custom:<name>`.
`used` is the absolute amount already consumed. `total` is optional and updates `quota_total` only.

CSV:

```csv
pool,amount,note
cursor_models,12,
cursor_other,40.5,other models
```

CSV `amount` is treated as absolute used, same as JSON `used`.

Apply rules:

- If snapshot used is greater than the pool's current `quota_used`, HeavyScope adds a `sync` usage record for the difference.
- If snapshot used is less than or equal to current used, nothing is subtracted. Manual history is kept.
- Re-applying the same snapshot is idempotent. HeavyScope stores a hash of the last applied used/total values and skips duplicates.

Auto-sync re-reads the last imported snapshot on the configured interval. It does not pull live Cursor usage.

The Grok adapter is reserved and returns Coming soon.

## Privacy

The database is a sql.js file encoded in localStorage under heavyscope.sqlite.v1. Reset it from Settings.
