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
- [x] Reset rollover that archives the previous window (0.7.1: zero quota, advance reset_at, keep history)

## Phase 4 — UI polish + Settings + i18n persist
- [x] Dashboard density and visual polish
- [x] Settings refinements (pool management + alert thresholds)
- [x] Confirm language + other prefs persist across sessions

## Phase 5 — Tauri 2 macOS menu bar
- [x] Tauri 2 desktop tray / macOS menu-bar shell
- [x] Share the same sql.js schema and UI (no native SQL plugin)

## Phase 6 — data source adapters (Cursor first, Grok reserved)
- [x] Cursor snapshot / CSV adapter (import + idempotent re-apply)
- [x] Auto-sync interval (re-applies last imported snapshot)
- [x] Grok / xAI adapter reserved (Coming soon)
- [x] Keep manual entry as the source of truth when adapters fail

## Phase 7 — packaging / tests / docs
- [x] Tests for burn-rate math, charts, and adapter apply (Vitest)
- [x] Desktop packaging / installers (Linux .deb can be built locally; macOS menu bar must be built on a Mac)
- [x] Release notes and 0.7.0 polish (README, CHANGELOG, docs/RELEASE.md)

## 0.8.0 — live usage sync

- [x] Settings → Data sources: Cursor `WorkosCursorSessionToken` + Grok session/bearer (local settings only)
- [x] Cursor `GET /api/usage-summary` → preset-cursor-models / preset-cursor-other percent pools
- [x] Grok `GetGrokCreditsConfig` proto walker → preset-grok-heavy; Bot only if a product segment exists
- [x] Vite `/proxy/cursor` + `/proxy/grok`; Tauri `@tauri-apps/plugin-http`
- [x] Optional macOS-only read of Cursor `state.vscdb` (Linux stub)
- [x] Auto-refresh 5 minutes (1–60) via shared `sync_enabled` / `sync_interval_min` / `sync_source` (`cursor` | `grok` | `both`)
- [x] Absolute live apply (write lower used on reset; sync record only when used changed)
- [x] Backup export redacts session tokens
- [ ] Keep researching Grok Bot / Agents product breakdown if the proto grows a named segment
- [ ] Full macOS Accessory tray rewrite (another track)
- [ ] Heatmap / chart layout (another track)

## Polish / leftover gaps (0.7.6)

- [x] Replace native `window.confirm` with in-app AlertDialogs (delete pool, reset DB, demo re-apply, import, replace-all)
- [x] Confirm/AlertDialog a11y: Radix focus trap + Escape + describedby; destructive confirm type=button
- [x] Copy JSON next to Export JSON (`navigator.clipboard.writeText` of the same backup payload; flash success/failure)
- [x] Paste JSON next to Import file (`navigator.clipboard.readText` into the backup textarea; flash success/failure; user still clicks Apply backup)

## Polish / leftover gaps (0.7.5)

- [x] Demo usage seed from Settings → Local data (`src/lib/demoSeed.ts`); skip unless confirm again

## Polish / leftover gaps (0.7.4)

- [x] JSON export / import of local data (`src/lib/backup.ts`); merge default, optional replace-all

## Polish / leftover gaps (0.7.3)

- [x] Preset pool display names via i18n (`displayPoolName`); stored names stay English

## Polish / leftover gaps (0.7.2)

- [x] Render ErrorBoundary + bilingual fallback (reload)
- [x] Sample Cursor snapshot JSON linked from README

## Polish / leftover gaps (0.7.1)

- [x] GitHub Actions CI (Node 22 + test/build)
- [x] Visible DB open error (ErrorState) instead of a blank page
- [x] Quota cycle rollover without deleting usage history
- [x] History date-input i18n hint (browser locale picker unchanged)
- [x] Live Cursor / Grok usage sync (0.8.0; unofficial dashboard endpoints + local tokens)
- [ ] Signed macOS menu-bar binary / codesign (needs a Mac and certificates)
- [ ] Windows installer
- [ ] GitHub Release asset upload (MCP has no create-release tool)
- [x] React render-error boundary beyond DB open failures (0.7.2)
