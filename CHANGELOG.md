# Changelog

All notable changes to this project are documented in this file.

The format is based on Keep a Changelog, and this project uses Semantic Versioning.

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
