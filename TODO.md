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
- [x] Absolute live apply (write lower used on reset; insert `source=sync` only when used increased)
- [x] Backup export redacts session tokens
- [x] macOS Accessory tray (`/tray` + status-item panel) from main
- [x] Dashboard heatmap + modular chart layout from main
- [ ] Keep researching Grok Bot / Agents product breakdown if the proto grows a named segment

## 0.10.0 — web dashboard usable

- [x] Stable 4-column grid from `md` (no lg span hybrid); overlay edit chrome; same-row stretch
- [x] Informative 1/4 pool cards (name, used%, bar, remaining, reset, unit)
- [x] History / default charts hide demo; live sync + manual is the default source
- [x] Timer from stored credentials for Cursor and Grok; per-provider last / next sync
- [x] Broader Grok Bot name match + second-percent heuristic + parsed-product line
- [x] GetGrokCreditsConfig fields 2–6 + prepaid diagnostics; gRPC 16 needs-bearer; CLI billing JSON fallback (fixtures)
- [x] Interval membership from cookie/bearer/token immediately (no `grokLive` / `sync_source` gate)
- [x] Trend uses live deltas; heatmap 26 weeks + amount intensity when units match
- [x] Unit-safe pies restored (used % + remaining share)
- [x] Version 0.10.0 (package.json + src-tauri)
- [x] Tray feature-parity beyond shared grid/sync helpers (0.11.0)

## 0.12.0 — web polish + Grok Bot productUsage

- [x] CLI billing JSON is first-class when a Grok Bearer is saved (every tick, not only after proto expiry)
- [x] `productUsage` `Api` / Bot / Agents → `preset-grok-bot`; Heavy from `creditUsagePercent` (GrokBuild is display-only, no double-count)
- [x] GetGrokCreditsConfig field 7 `product_usage` walker; field 12 prepaid
- [x] Heatmap squares via `squareCellPx` — cells never stretch
- [x] Quota overview + Recent records scroll; pies degrade on `sm` / `md`
- [x] Purple primary for light + dark; version 0.12.0
- [ ] Verify Grok Bot auto-track on a real Bearer (`Api 11%` → Bot) without manual calibrate
- [x] Do not start macOS tray 1.5x / horizontal-scroll work here (moved to 0.13.0)

## 0.14.0 — Cursor Spending live sync

- [x] `POST /api/dashboard/get-current-period-usage` + aggregations/events + usage-summary fallback
- [x] Cursor Models stays a request/% pool from `autoPercentUsed` (`quotaTotal=100`)
- [x] Cursor Other is USD from `planUsage.totalSpend` / `limit` (default $400); stop mapping `apiPercentUsed` as 0–100%
- [x] Grok Bot from a conservative Bot/API/Agents SKU row only; omit (unavailable) when missing; do not invent a weekly cap
- [x] Exclude Composer, Cursor Grok chat models, and Heavy from `grok_bot`
- [x] HTTP 401/403 → `code: "expired"` + zh-CN/en `live.cursorExpired`
- [x] Grok.com proto / CLI billing stays as a supplement
- [x] Reuse `liveFetch` / Vite proxy / Tauri `plugin-http` + `cursorCookieHeader`
- [x] `applyAbsoluteUsage` unchanged (absolute used/total; `source=sync` only when used rises)
- [x] Backup redaction still omits the session token
- [x] Vitest fixtures: three pools, missing Grok, Other USD, 401/403
- [x] Version 0.14.0 (package.json + src-tauri)
- [ ] Verify three-pool Refresh now on a real Cursor session (Spending dashboard)

## 0.13.0 — tray product polish

- [x] Default `/tray` lists every visible `tray_layout` pool (scroll); no hard cap of 2. Tightest 1–2 stay highlighted. Hidden stay hidden; new pools appear; deleted drop
- [x] Heatmap uses `squareCellPx` + 8–10px clamp; never stretch; 10-week grid; horizontal overflow scroll
- [x] Panel ~380×780 (1.5× height). Settings still in-pane with the same keys, connect, interval, Refresh now, Grok `Api → Grok Bot`
- [x] Version 0.13.0 (package.json + src-tauri). Accessory policy unchanged; no `?` on `App::set_activation_policy`

## 0.11.0 — tray live connect

- [x] Compact `/tray` Settings pane (same keys as web Data sources)
- [x] Refresh now + credential-based interval from the menu-bar popup
- [x] Expand/collapse pool rows (one open at a time; 0.13.0 lists every visible pool)
- [x] Per-provider last sync / not connected / expired on the compact dashboard
- [x] Version 0.11.0 (package.json + src-tauri)
- [ ] Verify Settings pane + paste token + refresh + expand pool on a real Mac

## 0.9.0 — widget dashboard reshape

- [x] 4-column widget grid with `sm` / `md` / `lg` / `xl` tiles for advisor, heatmap, trend, and every pool
- [x] Session Edit / Done mode: drag reorder, resize, hide / restore (normal mode has no chrome)
- [x] Persist `dashboard_layout` + `tray_layout`; migrate `chart_show_*` / `chart_module_order`
- [x] GitHub contribution heatmap colors (light + dark CSS variables)
- [x] Compact `/tray` 2-column widget grid with its own layout
- [x] Version 0.9.0 (package.json + src-tauri)

## Chart polish leftover

- [x] Heatmap cells stay perfect squares (`squareCellPx`); leftover card space is legend, not stretched cells
- [x] Independent full-width advisor / heatmap / trend modules + HTML5 drag-and-drop reorder
- [x] Theme: dark / light / system (`theme` setting + localStorage)
- [x] Compact `/tray` (0.13.0: all visible pools scroll, square heatmap, ~380×780)
- [x] iPhone-widget card system with edit mode, resize, reorder, hide/restore (0.9.0)
- [x] Amount-normalized heatmap intensity when all records share one unit (0.10.0)
- [ ] Persist Day / Week / Month scale (currently component state only)
- [ ] Optional heatmap filter by pool
- [ ] Stacked trend Y-axis still sums raw amounts across mixed units; consider per-unit facets
- [ ] Heatmap month-label collisions on very narrow cards
- [x] macOS tray feature-parity with the 0.10.0 web dashboard (0.11.0 connect + refresh + expand)

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
- [x] macOS compile: `App::set_activation_policy` is unit in Tauri 2.11.3 (no `?`)
- [ ] Signed macOS menu-bar binary / codesign (needs a Mac and certificates)
- [ ] Verify Accessory on a real Mac: no Dock icon, `LSUIElement`, template status item
- [ ] Verify the ~380×780 panel anchors under the status item (not screen center) and hides on click-outside / deactivate
- [x] `/tray` compact plugin: Settings pane, Refresh now, all visible expandable pools, last-sync lines, optional square heatmap (en / zh-CN)
- [ ] Measure release `.app` / `.dmg` size on a Mac (`du -sh`; target < 50MB, ideally 20–30MB) — steps in docs/MACOS.md
- [ ] Windows installer
- [ ] GitHub Release asset upload (MCP has no create-release tool)
- [x] React render-error boundary beyond DB open failures (0.7.2)
