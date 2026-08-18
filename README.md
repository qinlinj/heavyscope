# HeavyScope

Local-first multi-quota monitoring panel for SuperGrok Heavy and Cursor Ultra.

HeavyScope helps you see how fast you are burning weekly or monthly quotas, when a pool will reset, and whether you should switch work to a pool with more headroom. The same React UI runs as a web app and inside a Tauri 2 desktop shell. Quota data stays on your machine. There is no HeavyScope cloud account.

## Features

- **Dashboard** — four preset pools plus custom services, progress bars, remaining quota, reset countdown, and usage-tone colors
- **Advisor** — recommended daily pace, today used, waste / overspend risk, and cross-pool switch suggestions
- **Charts** — daily stacked area (14 days), weekly stacked bars (8 weeks), and pool-share donut
- **History** — filter usage records by pool, date range, and source
- **Settings** — pool management, alert thresholds, language (EN / 中文)
- **Adapters** — paste a Cursor usage snapshot (JSON or CSV); optional auto-sync re-applies the last import; Grok adapter is reserved (Coming soon)
- **Tauri desktop** — tray / macOS menu-bar shell around the same web UI and sql.js database

Manual entry remains the source of truth. Adapters never scrape Cursor or Grok credentials, cookies, or private APIs.

## Stack

- Vite + React + TypeScript
- Tailwind CSS v4 + shadcn/ui + Recharts
- react-i18next (zh-CN, en)
- sql.js SQLite (web and Tauri webview)
- Tauri 2 tray shell in `src-tauri`
- Vitest for unit tests

## Develop

Requires Node.js 22 and the package manager pinned in package.json.

Use the package manager to install, then run the dev, build, and test scripts from package.json.

pnpm install

Other scripts: typecheck, preview, lint.

## Desktop

src-tauri wraps the existing Vite React app. Click the tray icon to open the window. Close hides to tray. Use Quit to exit.

Run the package.json tauri script with the dev or build subcommand.

macOS menu bar must be built on a Mac. Linux .deb installers can be built locally. macOS app and dmg binaries require a Mac.

Identifier is com.heavyscope.app. Product name is HeavyScope.

Generate icons from src-tauri/app-icon.svg with the tauri icon command.

## Cursor snapshot format

Paste JSON or a simple CSV in Settings -> Data sources. This Linux/web build cannot read the Cursor app database. Provide an export you created yourself. HeavyScope does not invent live quota numbers.

JSON example: source cursor, fetchedAt ISO timestamp, pools array of hint/used/total.

hint values: grok_heavy, grok_bot, cursor_models, cursor_other, or custom:<name>.
used is the absolute amount already consumed. total is optional and updates quota_total only.

CSV header: pool,amount,note. CSV amount is treated as absolute used, same as JSON used.

Apply rules:

- If snapshot used is greater than the pool current quota_used, HeavyScope adds a sync usage record for the difference.
- If snapshot used is less than or equal to current used, nothing is subtracted. Manual history is kept.
- Re-applying the same snapshot is idempotent. HeavyScope stores a hash of the last applied used/total values and skips duplicates.

Auto-sync re-reads the last imported snapshot on the configured interval. It does not pull live Cursor usage.

The Grok adapter is reserved and returns Coming soon.


Example JSON:

{
  "source": "cursor",
  "fetchedAt": "2026-08-18T10:00:00.000Z",
  "pools": [
    { "hint": "cursor_models", "used": 12, "total": 500 },
    { "hint": "cursor_other", "used": 40.5, "total": 400 }
  ]
}

Example CSV:

pool,amount,note
cursor_models,12,
cursor_other,40.5,other models

## Privacy

All quota data stays local. The database is a sql.js file encoded in localStorage under heavyscope.sqlite.v1. Reset it from Settings. There is no HeavyScope cloud, analytics, or remote sync.

## License

MIT. See LICENSE.

## Language

Repository docs and source comments are English. UI strings live in src/i18n/locales/.
