# TODO

GitHub: https://github.com/qinlinj/heavyscope

## Phase 0 — environment / repo / scaffold
- [x] Observe box toolchain (Node 22, package manager, git, gh, Rust)
- [x] Initialize Vite + React + TypeScript project
- [x] Add Tailwind CSS, shadcn/ui, react-i18next
- [x] Write AGENTS.md, TODO.md, CHANGELOG.md, README.md
- [x] Private GitHub repository at https://github.com/qinlinj/heavyscope

## Phase 1 — data model + manual entry + basic dashboard + i18n
- [x] Define SQLite schema (pools, usage_records, settings)
- [x] sql.js local database wrapper (init, migrate, CRUD)
- [x] Pool CRUD + four preset pools
- [x] Manual usage records
- [x] Multi-pool dashboard with progress, remaining, reset countdown
- [x] Usage color scale green to yellow to red
- [x] i18n zh-CN / en with localStorage persistence
- [x] Dashboard / Settings routes
- [x] Dark modern UI
- [x] Production build green
- [x] Upload Phase 0-1 source to GitHub

## Phase 2 — Burn Rate Advisor
- [x] Pure burn-rate helpers in src/lib/burnRate.ts
- [x] Recommended daily, today used, today still safe
- [x] Average vs recommended pace
- [x] Waste / overspend risk badges
- [x] Cross-pool switch suggestion
- [x] Advisor section above the pool grid + compact PoolCard lines
- [x] i18n keys for zh-CN and en

## Phase 3 — charts + history
- [x] Per-pool usage history page (`/history` with pool / date / source filters)
- [x] Daily, weekly, and pool-share charts on the dashboard
- [ ] Reset rollover that archives the previous window (deferred; official Phase 3 is charts + history)

## Phase 4 — UI polish + Settings + i18n persist
- [x] Dashboard density and visual polish
- [x] Settings refinements (pool management + alert thresholds)
- [x] Confirm language + other prefs persist across sessions

## Phase 5 — Tauri 2 macOS menu bar
- [x] Tauri 2 desktop tray / macOS menu-bar shell
- [x] Share the same sql.js schema and UI (no native SQL plugin)

## Phase 6 — data source adapters (Cursor first, Grok reserved)
- [ ] Optional Cursor local usage adapter (read-only)
- [ ] Grok / xAI adapter reserved
- [ ] Keep manual entry as the source of truth when adapters fail

## Phase 7 — packaging / tests / docs
- [ ] Tests for burn-rate math, schema, and CRUD
- [ ] Desktop packaging / installers
- [ ] Release notes and 1.0 polish
