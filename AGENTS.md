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
- Later: Tauri 2 macOS menu bar (Phase 5)

## Phases

- Phase 0 — environment, repo, docs, schema, first push
- Phase 1 — runnable Web MVP (pools, usage, dashboard, i18n)
- Phase 2 — history charts, better reset logic, export/import
- Phase 3 — Cursor / Grok adapters (read-only local sources)
- Phase 4 — notifications, usage alerts, polish
- Phase 5 — Tauri 2 macOS menu bar
- Phase 6 — packaging and auto-update
- Phase 7 — hardening, tests, release notes

## Commits

Use conventional commits (feat:, fix:, docs:, chore:).
