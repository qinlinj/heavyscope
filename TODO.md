# TODO

## Phase 0 — bootstrap
- [x] Observe box toolchain (Node 22, package manager, git, gh, Rust)
- [x] Initialize Vite + React + TypeScript project
- [x] Add Tailwind CSS, shadcn/ui, react-i18next
- [x] Write AGENTS.md, TODO.md, CHANGELOG.md, README.md
- [x] Define SQLite schema (pools, usage_records, settings)
- [ ] Private GitHub repository + push (gh not logged in; GitHub MCP create returned 403)

## Phase 1 — Web MVP
- [x] sql.js local database wrapper (init, migrate, CRUD)
- [x] Pool CRUD + four preset pools
- [x] Manual usage records
- [x] Multi-pool dashboard with progress, remaining, reset countdown
- [x] Usage color scale green to yellow to red
- [x] i18n zh-CN / en with localStorage persistence
- [x] Dashboard / Settings routes
- [x] Dark modern UI
- [x] Production build green
- [ ] Push feat commit to GitHub (blocked on repo-create token)

## Phase 2 — history
- [ ] Per-pool usage history page
- [ ] Reset rollover that archives the previous window
- [ ] JSON export / import

## Phase 3 — adapters
- [ ] Optional Cursor local usage adapter (read-only)
- [ ] Optional Grok / xAI usage adapter
- [ ] Keep manual entry as the source of truth when adapters fail

## Phase 4 — alerts
- [ ] Threshold notifications
- [ ] Custom pool templates
- [ ] Dashboard density options

## Phase 5 — desktop
- [ ] Tauri 2 macOS menu bar
- [ ] Share the same SQLite schema

## Phase 6 — packaging
- [ ] Desktop installers
- [ ] Auto-update sketch

## Phase 7 — harden
- [ ] Tests for schema, reset math, and CRUD
- [ ] Release notes and 1.0 polish
