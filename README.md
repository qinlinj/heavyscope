# HeavyScope

Local-first multi-quota monitoring panel for SuperGrok Heavy and Cursor Ultra.

HeavyScope helps you see how fast you are burning weekly or monthly quotas, when a pool will reset, and whether you should switch work to a pool with more headroom. The same React UI runs as a web app and inside a Tauri 2 desktop shell. Quota data stays on your machine. There is no HeavyScope cloud account.

Current product version is **0.8.0**.

## Features

- **Dashboard + burn rate advisor** — four preset pools plus custom services, progress bars, remaining quota, reset countdown, and usage-tone colors. The advisor shows recommended daily pace, today used, waste / overspend risk, and cross-pool switch suggestions.
- **Charts / history** — Daily Activity heatmap fills the card width (record count, not mixed-unit amounts), Day / Week / Month stacked trend, and per-pool used% bars. Advisor / heatmap / trend are independent full-width modules; show, hide, or drag to reorder. History filters usage records by pool, date range, and source. Date pickers follow the browser locale.
- **Settings** — pool management (add / edit / delete), alert thresholds (warn / crit), language (EN / 中文), theme (dark / light / system; default dark), JSON backup export / copy / import, and optional demo usage seed.
- **Live Cursor + Grok sync** — connect your own accounts once in Settings → Data sources. HeavyScope refreshes remaining quota on a timer (default 5 minutes). Snapshot import and manual entry stay as fallbacks.
- **Cursor snapshot import** — paste a Cursor usage snapshot (JSON or CSV) in Settings → Data sources. Optional auto-sync re-applies the last import when live Cursor is not connected.
- **JSON backup export / copy / import** — Settings → Local data downloads `heavyscope-backup.json`, copies the same payload to the clipboard, or accepts a file / paste (table dump, not a wasm / binary file). Merge is the default; replace-all is optional.
- **Demo seed** — load sample usage for the four preset pools (last 10 days, English notes) so charts and the advisor look alive. First load applies immediately; a later load asks for confirm because `demo_seeded=1`.
- **Tauri 2 tray** — system tray / macOS menu-bar shell around the same web UI and sql.js database. On macOS the shell is an **Accessory** (no Dock icon); the popup anchors under the status item and loads a compact `/tray` view. Linux/Windows keep a normal tray window. Close hides to tray. Use Quit to exit. **Verify the menu-bar accessory on a real Mac** — see [docs/MACOS.md](docs/MACOS.md).
- **In-app confirm dialogs** — delete pool, reset local database, demo re-apply, import, and import replace-all use in-app AlertDialogs with zh-CN / en titles and actions. Native `window.confirm` is not used.
- **Cycle rollover** — when a pool `reset_at` is past, quota used resets to 0, the next weekly/monthly date is set, and a Cycle reset usage note is stored. History is not deleted.

Manual entry remains the source of truth when a connector fails. Tokens you paste stay in the local settings table on this device. JSON backup export redacts them. Unofficial dashboard endpoints may change.

## Screenshots

Dashboard with demo usage, pool cards, burn-rate advisor, and charts:

![Dashboard](docs/images/dashboard.png)

Chinese dashboard with the four preset pools:

![Chinese dashboard](docs/images/dashboard-zh.png)

Settings — pool list and JSON backup export / copy / import:

![Settings backup](docs/images/settings-backup.png)

In-app confirm dialog when deleting a pool:

![Delete pool confirm](docs/images/confirm-delete.png)

## Stack

- Vite + React + TypeScript
- Tailwind CSS v4 + shadcn/ui + Recharts
- react-i18next (zh-CN, en)
- sql.js SQLite (web and Tauri webview)
- Tauri 2 tray / macOS Accessory shell in `src-tauri` (see [docs/MACOS.md](docs/MACOS.md))
- Vitest for unit tests
- GitHub Actions CI (Node 22, package manager from packageManager)

## How to run

Requires Node.js 22 and the package manager pinned in `package.json` (`pnpm@11.22.0`).

```bash
pnpm install
pnpm dev
```

`pnpm dev` proxies `/proxy/cursor` → `https://cursor.com` and `/proxy/grok` → `https://grok.com` so live sync works in the browser. A production static host cannot call those sites (CORS). Use the Tauri desktop app, or keep using snapshot / manual entry.

The Vite app is enough for local web development. Other scripts:

```bash
pnpm test
pnpm build
pnpm typecheck
pnpm preview
pnpm lint
```

Desktop (same UI, Tauri 2 tray):

```bash
pnpm tauri dev
pnpm tauri build
```

## Desktop

`src-tauri` wraps the existing Vite React app. Identifier is `com.heavyscope.app`. Product name is HeavyScope.

**macOS menu-bar is Accessory; verify on a real Mac.** `Info.plist` already has `LSUIElement`. Rust adds `ActivationPolicy::Accessory` and anchors a 380×520 panel under the status item on top of that — the Linux window stays 980×720 `center: true`. This Linux/web environment cannot produce those binaries. Build with `pnpm tauri build` on a Mac, then walk through the checklist and size measurements in [docs/MACOS.md](docs/MACOS.md). Linux `.deb` installers can be built locally. There is no Windows installer yet.

Generate bundle icons from `src-tauri/app-icon.svg` with the Tauri icon command before shipping if you change the mark. The menu-bar glyph is the monochrome template `src-tauri/icons/tray-template.png`.

## Live Cursor connect

1. Log in at [cursor.com](https://cursor.com).
2. Open DevTools → Application → Cookies → `https://cursor.com`.
3. Copy the **value** of `WorkosCursorSessionToken`.
4. Paste it into Settings → Data sources → Cursor live connect (password field) and click Connect.

The cookie is often `user_01…%3A%3AeyJ…` (URL-encoded `::`). Raw `user_01…::eyJ…` is also accepted. HeavyScope stores it only in the local sql.js settings table and never writes it to usage notes or logs.

On a **real Mac** desktop build you can use **Read from Cursor app (Mac)**. That command only reads `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb` key `cursorAuth/accessToken` and derives `sub::jwt`. It never writes the database. Linux CI compiles a stub. See [docs/MACOS.md](docs/MACOS.md).

Live mapping (unofficial `GET https://cursor.com/api/usage-summary`, same two-pool model used by AIUsageBar / cursor-stats):

- `preset-cursor-models` = Cursor Models (Auto/Composer) from `individualUsage.plan.autoPercentUsed`. Stored as `quota_total=100`, `quota_used=autoPercentUsed`, unit `%`.
- `preset-cursor-other` = Other Models from `apiPercentUsed`. If that field is missing and on-demand has a numeric limit, on-demand % may be used. When on-demand is enabled with a numeric limit, the pool note can also show $ used/limit.
- `reset_at` = `billingCycleEnd` for both pools. `reset_cycle` = monthly.

Auto-refresh uses the existing `sync_enabled` / `sync_interval_min` / `sync_source` settings. Default interval is **5 minutes** (1–60). `sync_source` can be `cursor`, `grok`, or `both` so both live connectors can run on one ticker. Live values are **absolute**: `quota_used`, `quota_total`, and `reset_at` are written even when used goes down (cycle reset). A `source=sync` record is inserted only when used increased; a lower used number still updates the pool and does not write a negative usage bar. A 401 marks the connector expired and does not wipe pools. Refresh now is on the dashboard and in Settings.

These endpoints are unofficial and may change.

## Live Grok connect

1. Log in at [grok.com](https://grok.com).
2. Copy a grok.com session cookie (DevTools → Application → Cookies) and/or a Bearer token from the grok.com session / xAI OAuth flow.
3. Paste one or both into Settings → Data sources → Grok live connect and click Connect.

HeavyScope calls the same gRPC-web method as grok.com Settings → Usage:

`POST https://grok.com/grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig`

- `preset-grok-heavy` = shared weekly SuperGrok Heavy pool from `credit_usage_percent` (0 if omitted). `quota_total=100`, unit `%`, `reset_cycle=weekly`, `reset_at` = billing period end.
- `preset-grok-bot` is updated only when a Bot / Grok Bot / Agents / API-for-bot product segment is present. If it is not found, HeavyScope does **not** invent numbers. The Bot pool is marked “Live sync unavailable — calibrate manually”.

Same CORS rule as Cursor: desktop Tauri HTTP or `pnpm dev` proxy.

## Cursor snapshot format

Paste JSON or a simple CSV in Settings → Data sources. This Linux/web build cannot read the Cursor app database. Provide an export you created yourself. HeavyScope does not invent live quota numbers.

JSON fields: `source` (`cursor`), `fetchedAt` (ISO timestamp), `pools` array of `hint` / `used` / `total`.

`hint` values: `grok_heavy`, `grok_bot`, `cursor_models`, `cursor_other`, or `custom:<name>`.
`used` is the absolute amount already consumed. `total` is optional and updates `quota_total` only.

CSV header: `pool,amount,note`. CSV `amount` is treated as absolute used, same as JSON `used`.

Apply rules:

- If snapshot `used` is greater than the pool current `quota_used`, HeavyScope adds a `sync` usage record for the difference.
- If snapshot `used` is less than or equal to current used, nothing is subtracted. Manual history is kept.
- Re-applying the same snapshot is idempotent. HeavyScope stores a hash of the last applied used/total values and skips duplicates.

Auto-sync re-reads the last imported snapshot on the shared interval only when Cursor is in `sync_source` and no Cursor session token is stored. Once a session token is connected, the ticker fetches live usage-summary instead of re-applying the snapshot string.

Example JSON:

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

A copy of this sample (clearly marked SAMPLE ONLY, fake demo numbers) lives in [docs/cursor-snapshot.example.json](docs/cursor-snapshot.example.json).

Example CSV:

```csv
pool,amount,note
cursor_models,12,
cursor_other,40.5,other models
```

## JSON backup format

Settings → Local data exports `heavyscope-backup.json`, or copies the same JSON to the clipboard. This is a JSON dump of the current sql.js tables, not the wasm binary.

Shape:

```json
{
  "version": 1,
  "exportedAt": "2026-08-18T12:00:00.000Z",
  "pools": [],
  "usage_records": [],
  "settings": { "language": "en", "warn_percent": "70", "crit_percent": "90" }
}
```

- `version` is the backup format version (currently `1`).
- `exportedAt` is an ISO timestamp.
- `pools` rows include `id`, `name`, `type` (`credits` | `requests` | `usd` | `custom`), `quota_total`, `quota_used`, `reset_at`, `reset_cycle` (`weekly` | `monthly` | `none`), `unit`, `color`, `is_preset`, `created_at`, `updated_at`.
- `usage_records` rows include `id`, `pool_id`, `amount`, `recorded_at`, `note`, `source` (`manual` | `import` | `sync`).
- `settings` is a string-to-string map. Export omits `cursor_session_token`, `grok_session_token`, and `grok_bearer_token`.

Import rules:

- **Merge** (default): pools upsert by id (imported wins), usage records insert if the id is unknown, settings keys merge. Language is not wiped unless the file includes it.
- **Replace-all** (optional): existing pools and usage are cleared first, then the file is applied. Settings still merge. Replace-all does not run unless you choose it and confirm again.

Import and replace-all use in-app confirm dialogs.

## Privacy

All quota data stays local. The database is a sql.js file encoded in localStorage under `heavyscope.sqlite.v1`. Export or import a JSON backup (or reset) from Settings. There is no HeavyScope cloud, analytics, or remote sync.

Session tokens you paste (`cursor_session_token`, `grok_session_token`, `grok_bearer_token`) stay in the local settings table. They are never written to `usage_records` notes. JSON backup export omits those keys. Live calls go from your machine to cursor.com / grok.com (Tauri HTTP or the Vite dev proxy). Unofficial endpoints may change without notice. The optional macOS `state.vscdb` helper is read-only and is not used in Linux CI.

## License

MIT. See LICENSE.

## Language

Repository docs and source comments are English. UI strings live in `src/i18n/locales/`.
