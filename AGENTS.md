# HeavyScope contributor guide

Follow this loop on every turn. Do not stop unless the user says stop.

## Work loop

1. Observe — inspect the workspace, tools, git status, running processes, and product files.
2. Think — decide what the current phase actually needs.
3. Judge — pick the highest-leverage next action. Prefer a working product over extra docs.
4. Plan — write a short plan, then execute it immediately.
5. Execute — implement on this machine. Install missing tools yourself.
6. Check — run the production build (and focused tests when they exist) after meaningful changes.
7. Reflect — update TODO.md and CHANGELOG.md, then continue the loop.

Never wait for the user to unblock routine decisions.

## Language

- Code, comments, commit messages, file names, and repository docs are English.
- UI copy lives in i18n catalogs. Default UI language is zh-CN, with en supported.

## Stack

- Vite + React + TypeScript
- Tailwind CSS + shadcn/ui + Recharts + react-i18next
- SQLite via sql.js on Web; schema is defined in src/db/schema.ts
- Package manager listed in package.json packageManager field
- Tauri 2 desktop tray / macOS menu-bar shell in src-tauri (Phase 5)

## Repository

https://github.com/qinlinj/heavyscope

## Phases

- Phase 0 — environment, repo, scaffold (done)
- Phase 1 — data model + manual entry + basic dashboard + i18n (done)
- Phase 2 — Burn Rate Advisor (done)
- Phase 3 — charts + history (done)
- Phase 4 — UI polish + Settings + i18n persist (done)
- Phase 5 — Tauri 2 macOS menu bar (done)
- Phase 6 — data source adapters (Cursor first, Grok reserved) (done)
- Phase 7 — packaging / tests / docs (done)
- 0.7.1 polish — CI, DB error UI, quota cycle rollover (done)
- 0.7.2 polish — render ErrorBoundary, sample Cursor snapshot (done)
- 0.7.3 polish — localize preset pool display names (done)
- 0.7.4 polish — JSON export / import of local data (done)

## Commits

Use conventional commits (feat:, fix:, docs:, chore:).
