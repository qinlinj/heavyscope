# Changelog

All notable changes to this project are documented in this file.

The format is based on Keep a Changelog, and this project uses Semantic Versioning.

## [Unreleased]

## [0.14.0] - 2026-08-21

### Added

- Cursor Spending live sync from unofficial dashboard endpoints (same `WorkosCursorSessionToken` as usage-summary). Refresh now and the interval tick can fill **three** pools from a Cursor session alone: Grok Bot (`grok_bot` → `preset-grok-bot`), Cursor Models (`cursor_models` → `preset-cursor-models`), and Cursor Other $400 (`cursor_other` → `preset-cursor-other`).
- `POST /api/dashboard/get-current-period-usage` for cycle limits (`autoPercentUsed`, `planUsage.totalSpend` / `limit` in cents). `POST /api/dashboard/get-aggregated-usage-events` (and filtered events if needed) for a conservative Grok Bot / Grok API / Agents SKU row. `GET /api/usage-summary` remains a Models % fallback.
- zh-CN / en `live.cursorExpired` when the Cursor session returns HTTP 401/403.

### Changed

- Cursor Other is a **USD** pool (`planUsage.totalSpend` / `limit`, default total $400). It is no longer mapped from `apiPercentUsed` as 0–100%.
- Grok Bot from Cursor spending is omitted unless a real Bot/API/Agents row exists. Composer, Cursor Grok chat models, and Heavy are never used as Bot. Grok.com proto / CLI billing stays as a supplement.
- Version 0.14.0 (package.json + src-tauri). Tokens stay local; backups still redact the session token. Vite `/proxy/cursor` sends `Origin: https://cursor.com` for dashboard POSTs.

## [0.13.0] - 2026-08-20

### Fixed

- Tray default dashboard no longer hard-caps at 1–2 pools. `selectTrayDashboardPools` lists **every visible pool tile** from `tray_layout` (layout order, scroll if needed). Hidden tiles stay hidden. New pools appear; deleted pools drop. Collapsed rows still highlight the tightest 1–2.
- Compact tray heatmap uses the same `squareCellPx` helper as the 0.12.0 web grid, then clamps to 8–10px squares. Cells never stretch to fill the taller panel. 10-week grid with horizontal overflow scroll + optional prev/next.

### Added

- Horizontal overflow strips (wheel / shift-wheel and prev/next) for heatmap and Settings fields that are wider than the panel.

### Changed

- macOS menu-bar popup is about 1.5× taller: **380×780** (max 420×820). Width stays a plugin-sized strip. Linux/Windows 980×720 window is unchanged. Accessory policy and `App::set_activation_policy` without `?` stay.
- Default `/tray` stack: advisor one-liner, scrollable pool rows (one expanded at a time), last-sync lines, optional square heatmap. Settings gear is still a second pane in the same window. Layout Edit remains secondary but its visibility is honored on the default dashboard.
- Unified tray type scale (`text-sm` titles / `text-xs` body) matching the web. Purple primary, dark / light / system unchanged.
- Version 0.13.0 (package.json + src-tauri). `optimizeDeps.include: ["sql.js"]` stays. Tokens stay local; backups still redact them.

## [0.12.0] - 2026-08-20

### Added

- First-class Grok CLI billing JSON on every tick when a Bearer is saved: `GET /v1/billing?format=credits` maps `productUsage` `Api` → Grok Bot automatically. Cookie-only users still use GetGrokCreditsConfig.
- GetGrokCreditsConfig proto field 7 `product_usage` (ProductUsage name + percent). Field 12 is prepaid. Heavy stays on `creditUsagePercent` so GrokBuild 0 does not overwrite the shared Heavy meter.
- Settings / tray parsed-product lines show the mapping (`Api 11% → Grok Bot`). If neither JSON nor proto has Bot/Api, Bot stays unavailable and names are shown without invented numbers.
- Heatmap `squareCellPx(width, height, weeks)`: cells are perfect squares and do not stretch when the card is wide or short. Leftover space is for the legend + 26-week / intensity hint.

### Changed

- Quota overview copy is shorter. The title block is `max-w-xl`. Advisor metrics, used% bars, and Recent records scroll inside a fixed max height instead of growing the card.
- Pies: `sm` is a pure pie with tooltip only; `md` uses a short outside legend; `lg` / `xl` keep remaining numbers. No colliding slice labels.
- Amounts use 0 fraction digits for integers / request counts and at most 2 for % or $.
- Purple primary works in light and dark. Theme dark / light / system is unchanged.
- Version 0.12.0 (package.json + src-tauri). No Tauri behavior change. `optimizeDeps.include: ["sql.js"]` and `App::set_activation_policy` without `?` stay.

## [0.11.0] - 2026-08-20

### Added

- Compact `/tray` Settings pane (same 380×520 popup): Cursor `WorkosCursorSessionToken`, Grok session cookie / Bearer, interval 1 / 5 / 15 / 30 / 60, Refresh now, per-provider last sync + error, and a one-line Grok parsed-product toggle. Tokens use the same local settings keys as the web Data sources card.
- Default tray dashboard is a TokenScope-style stack: Refresh now + Settings gear in the header, one-line advisor, 1–2 tightest visible pools as expandable rows, last-synced lines for Cursor and Grok, and a tiny heatmap only when nothing is expanded.
- Click a pool row to expand used/total, advice, and the last 1–2 live deltas. Only one row is open at a time.

### Changed

- Edit / Done layout chrome stays, but is secondary to Settings. Normal mode has no grip / size / hide controls.
- Version 0.11.0 (package.json + src-tauri). Accessory policy, 380×520 panel size, and `optimizeDeps.include: ["sql.js"]` are unchanged.

## [0.10.0] - 2026-08-20

### Added

- Unit-safe pie tiles (`pies`): percent-used pie for every pool, plus a remaining-share pie among comparable absolute units (`$` / token-like). If no shared absolute unit exists, pie B is remaining % of each pool. `sm` shows the percent pie only. Hidden on the default tray layout.
- History source `demo` plus a default **Live + manual** filter. Demo-seeded rows are hidden from History and from default chart aggregations unless the user opts in.
- Per-provider last synced + next tick on the Dashboard header and Settings. Interval control is 1 / 5 / 15 / 30 / 60 minutes (default 5).
- Grok proto diagnostics: Settings shows parsed product names + percents from the last payload. Bot matching covers SuperGrok Bot, API for bots, x.com bots, `PRODUCT_GROK_BOT` / Agents, and a second non-Heavy percent heuristic (never invents Bot usage).
- Grok billing walk of `GetGrokCreditsConfig` fields 2–6 (`on_demand_cap` / `on_demand_used`, billing window, `history`) plus extra Cent as prepaid. Cents-only history stays in Settings; Heavy % history points seed heatmap/trend deltas.
- HTTP 200 + gRPC-web `grpc-status` 16 (headers or trailer) is treated as expired / needs Bearer. Cookie-only failures keep the interval running. Optional CLI billing JSON fallback when a Bearer is saved.

### Changed

- Dashboard grid is 1 column below `md`, then a stable 4-column `repeat(4, minmax(0,1fr))`. Span meaning no longer changes at `lg`. Same-row tiles stretch to one height. Edit chrome overlays the card so occupancy does not change. Hover lift is on the card, not the grid item.
- Compact (`sm` / 1/4) pool cards show name, used%, bar, remaining, reset countdown, and unit. Recent records and long advice stay on `md+`.
- Auto-refresh membership is credential-based: a stored Cursor session token or Grok session/bearer is enough, including when `sync_enabled` is still false after connect. Membership does not use `sync_source` or a `grokLive` connected flag. A failed Grok tick is shown and does not drop later intervals.
- Trend chart plots live usage deltas (`+N` per day / week / month bucket) from `source=sync` records after each successful apply.
- Heatmap default window is 26 weeks on large screens (12 when narrow, 10 compact tray). Intensity uses that day's amount when every contributing record shares one unit; mixed `$` and `%` stay on record count.
- Demo seed writes `source=demo` and is labeled sample-only. Existing `Demo seed:` import rows migrate on open.
- Version 0.10.0. Tray feature-parity is next; this release only shares the same grid/sync helpers on `/tray`.

### Fixed

- Edit-mode size chips (`sm` / `md` / `lg` / `xl`) no longer make neighboring cards overlap.

### Changed

- Daily Activity heatmap uses GitHub contribution greens via `--heat-0`…`--heat-4` on `:root` and `.dark`. Cells keep `w-full` + `repeat(weeks, minmax(0, 1fr))` + `aspect-square`, with a 3px gap, 2px radius, and a faint inset outline. Intensity remains daily record count.
- The always-visible ChartLayoutControls checkbox row is gone. Module visibility and order live in the widget layout.
- Version 0.9.0.

### Fixed

- macOS compile: `App::set_activation_policy` returns `()` in Tauri 2.11.3, so Accessory setup no longer uses `?`.

## [0.8.0] - 2026-08-19

### Added

- Live Cursor usage sync from unofficial `GET https://cursor.com/api/usage-summary` using a user-pasted `WorkosCursorSessionToken`. Maps Auto/Composer (`autoPercentUsed`) and Other/API (`apiPercentUsed`) onto the two Cursor preset pools as percent-of-100. Live apply writes absolute `quota_used` / `quota_total` / `reset_at` (including a lower used after reset) and inserts a `source=sync` record only when used increased.
- Live Grok usage sync from unofficial `POST https://grok.com/grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig` (gRPC-web empty body). Maps SuperGrok Heavy `credit_usage_percent`. Grok Bot is updated only when a Bot / Agents product segment is present.
- Settings → Data sources live connect panels (password fields, Connect / Disconnect / Refresh now) above the existing snapshot importer. Dashboard Refresh now syncs configured providers.
- Vite dev proxies `/proxy/cursor` and `/proxy/grok`. Tauri desktop uses `@tauri-apps/plugin-http` to bypass CORS.
- Optional macOS-only, read-only Cursor `state.vscdb` helper. Linux builds compile a stub.
- JSON backup export omits `cursor_session_token`, `grok_session_token`, and `grok_bearer_token`.
- Dashboard Daily Activity heatmap (GitHub-style, last 17 weeks on large screens / 12 weeks when narrow). Intensity is daily usage-record **count**, not summed amounts, so Cursor $ and Grok % stay comparable. Tooltip shows date + total count.
- Day / Week / Month scale toggle on the main stacked usage chart (Recharts area for day, bars for week/month).
- Per-pool used% bars replace the single mixed-unit pool-share pie.
- Dashboard module visibility and order for advisor / heatmap / trend. Keys: `chart_show_heatmap`, `chart_show_trend`, `chart_show_advisor` (default on), and `chart_module_order`. Persisted via `setSetting` on the settings table. Up/down buttons on the dashboard header.
- macOS Tauri 2 shell is a real menu-bar accessory on top of the existing `LSUIElement` Info.plist: Rust `ActivationPolicy::Accessory`, template status-item icon, hide-on-deactivate, and a 380×520 undecorated panel anchored under the tray rectangle (overrides the Linux 980×720 `center` window). Linux/Windows still compile as a normal tray window.
- Compact `/tray` route (en + zh-CN) for the accessory panel: tightest 1–2 pools plus an advisor one-liner. Browser preview at `/tray`.
- `docs/MACOS.md` — Mac build (`pnpm tauri build`), Accessory checklist, codesign note, `.app` / `.dmg` size, and the optional Cursor `state.vscdb` helper.

### Changed

- Auto-sync reuses `sync_enabled`, `sync_interval_min` (default **5**, was 30), `sync_last_at` / `sync_last_status` / `sync_last_message`, and `useSync`. `sync_source` is now `none` | `cursor` | `grok` | `both`. A connected session token is the auto-sync path; snapshot re-apply is fallback only.
- Charts section layout: heatmap stays about one quarter of the charts card when shown beside the trend; used% bars sit below the trend.
- `src-tauri` release profile now uses LTO, `opt-level = "s"`, and strip to keep the Mac bundle toward the < 50MB target.
- Version 0.8.0. Snapshot import and manual CRUD stay. `optimizeDeps.include: ["sql.js"]` and `fallbackLng` are unchanged.

## [0.7.6] docs / clipboard follow-up

### Added

- Settings → Local data: Paste JSON fills the import textarea from the clipboard via `navigator.clipboard.readText`. Success and failure flash in zh-CN / en. A pending flash shows immediately; `readText` is raced against a 3s timeout (timeout is treated as failure). Does not auto-apply; the user still clicks Apply backup.
- Settings → Local data: Copy JSON writes the same backup payload to the clipboard via `navigator.clipboard.writeText`. Success and failure flash in zh-CN / en. Product version stays 0.7.6.
- Product screenshots for the README: `docs/images/dashboard.png`, `docs/images/dashboard-zh.png`, `docs/images/settings-backup.png`, and `docs/images/confirm-delete.png`.

### Changed

- Confirm dialogs: Radix AlertDialog already traps focus and cancels on Escape; Title/Description supply `aria-labelledby` / `aria-describedby` for Dashboard/Settings delete and reset. Destructive confirm action is `type="button"`.

### Removed

- Temporary screenshot-upload leftovers (`docs/images/parts`, `docs/images/READY`, `docs/images/*.b64`) and the one-shot decoder workflow `.github/workflows/decode-screenshots.yml`.

## [0.7.6] - 2026-08-18

### Changed

- Destructive and data-loss prompts use in-app shadcn AlertDialogs instead of `window.confirm`: delete pool, reset local database, demo re-apply, import, and import replace-all. First-time demo seed applies without an extra confirm. Titles and actions are i18n zh-CN / en.
- Version 0.7.6.

## [0.7.5] - 2026-08-18

### Added

- Settings → Local data: Load demo data inserts sample `usage_records` for the four preset pools across the last 10 days and bumps `quota_used` so charts and the advisor look alive. English notes. Skips when `demo_seeded=1` unless the user confirms again.

### Changed

- Version 0.7.5.

## [0.7.4] - 2026-08-18

### Added

- JSON export / import of local data from Settings → Local data. Export downloads `heavyscope-backup.json` with `{ version, exportedAt, pools, usage_records, settings }` from the current sql.js tables (not the wasm binary). Import accepts a file or pasted JSON. Default merge: pools upsert by id (imported wins), usage records insert if the id is unknown, settings keys merge (language is left alone unless present). Optional replace-all needs a second confirm and does not run unless the user chooses it.

### Changed

- Version 0.7.4.

## [0.7.3] - 2026-08-18

### Added

- `displayPoolName(pool, t)` plus i18n keys for the four preset pools. Dashboard cards, Settings, History, Advisor, Charts, and dialogs show localized names. Custom pools still use `pool.name`. Stored rows are not rewritten.

### Changed

- Version 0.7.3.

## [0.7.2] - 2026-08-18

### Added

- React class ErrorBoundary around the app. A render crash shows a bilingual fallback (ErrorState + i18n) instead of a blank page. Reset reloads the window.
- Sample Cursor snapshot at docs/cursor-snapshot.example.json (fake demo numbers, marked SAMPLE ONLY) linked from the README.

### Changed

- Version 0.7.2. Settings About reads Vite __APP_VERSION__ from package.json (no leftover 0.5.0).

## [0.7.1] - 2026-08-18

### Added

- GitHub Actions CI on push/PR to main: Node 22, package manager from the packageManager field, then the test and build scripts.
- Visible ErrorState when HeavyScopeDB.open() fails, so a database error is not a blank page.
- Quota cycle rollover in src/lib/rollover.ts: overdue reset_at zeros quota_used, advances the next weekly/monthly reset, and inserts an amount=0 sync usage record with note "Cycle reset". Old usage history is kept for charts.

### Changed

- Version 0.7.1.
- History date inputs stay type=date (browser locale). An i18n hint explains that.

## [0.7.0] - 2026-08-18

### Added

- Vitest unit tests for burn-rate math, chart series, and Cursor snapshot apply (delta-only + idempotent hash skip).
- Complete English README covering features, stack, develop, desktop packaging, snapshot format, and privacy.
- MIT license and v0.7.0 release notes in docs/RELEASE.md.

### Changed

- Version 0.7.0.

## [0.6.0] - 2026-08-18

### Added

- Usage adapter layer (`manual`, `cursor`, `grok`) with a shared `UsageAdapter` interface.
- Cursor snapshot import (documented JSON or `pool,amount,note` CSV) from Settings.
- Idempotent snapshot apply: only the positive delta vs current `quota_used` is recorded as `source=sync`.
- Auto-sync interval (default 30 minutes) that re-applies the last imported Cursor snapshot.
- Reserved Grok adapter shown as Coming soon. Manual records stay when adapters fail.

### Changed

- Version 0.6.0.

## [0.5.0] - 2026-08-18

### Added

- Tauri 2 desktop shell around the existing Vite React app (src-tauri).
- System tray / menu-bar icon with Open and Quit. Left-click shows the window.
- Hide-to-tray on window close. macOS LSUIElement + macOSPrivateApi config for menu-bar style.
- Tray tooltip/title can show the hottest pool percent from local sql.js data.

### Changed

- Version 0.5.0. Web scripts are unchanged (dev / build / preview).

## [0.4.0] - 2026-08-18

### Added

- Settings now include pool management (add / edit / delete) and alert thresholds.
- Header language toggle (EN / 中文) plus language persisted in localStorage and the settings table.
- Default settings seed: `language=zh-CN`, `warn_percent=70`, `crit_percent=90`.

### Changed

- `usageTone` reads warn / crit thresholds from settings instead of hardcoded 70 / 90.
- Denser dashboard cards, tighter section headers, and version read from `package.json`.

## [0.3.0] - 2026-08-18

### Added

- Daily stacked area chart (last 14 days) and weekly stacked bar chart (last 8 weeks).
- Pool share donut based on `quota_used`.
- Usage history page at `/history` with pool, date range, and source filters.
- Dashboard / History / Settings navigation.

### Fixed

- Prebundle `sql.js` in Vite (`optimizeDeps.include`) so the dev app boots instead of a blank page.

## [0.2.0] - 2026-08-18

### Added

- Burn Rate Advisor with pure helpers in `src/lib/burnRate.ts`.
- Recommended daily quota, today used, and today-still-safe remaining.
- Average daily vs recommended pace, plus waste / overspend risk badges.
- Cross-pool switch suggestion when one pool is hot and another has headroom.
- Advisor summary above the dashboard pool grid and compact per-pool advisor lines.

## [0.1.0] - 2026-08-18

### Added

- Vite + React + TypeScript web app with Tailwind CSS v4 and shadcn/ui.
- Local SQLite schema for pools, usage_records, and settings, running on sql.js.
- Four preset quota pools: Grok Heavy weekly shared, Grok Bot weekly, Cursor Models, Cursor Other Models ($400).
- Pool create / edit / delete and manual usage recording.
- Dark dashboard with progress bars, remaining quota, reset countdown, and usage-tone colors.
- zh-CN / en i18n with localStorage persistence.
- Dashboard and Settings routes.
- Production build succeeds.
