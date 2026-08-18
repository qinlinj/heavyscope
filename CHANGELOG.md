# Changelog

All notable changes to this project are documented in this file.

The format is based on Keep a Changelog, and this project uses Semantic Versioning.

## [Unreleased]

### Added

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
