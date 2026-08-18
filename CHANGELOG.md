# Changelog

All notable changes to this project are documented in this file.

The format is based on Keep a Changelog, and this project uses Semantic Versioning.

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

### Known

- GitHub private repo creation is blocked. `gh` has no login, and the connected GitHub MCP token returns 403 on `user/repos` (missing repository-create scope). Local commits are on `main` and ready to push once a repo-capable token is available.
