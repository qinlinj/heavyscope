# HeavyScope

Local-first multi-quota monitoring panel for SuperGrok Heavy and Cursor Ultra.

Demo-first: a polished Web app now, Tauri 2 macOS menu bar later. All quota data stays in the browser (sql.js + localStorage). There is no HeavyScope cloud account.

## Features

- Four preset pools plus custom services
- Manual usage recording
- Dashboard cards with percent used, remaining amount, and reset countdown
- Progress color shifts green to yellow to red as usage rises
- Chinese UI by default, English available, language stored in localStorage

## Stack

- Vite + React + TypeScript
- Tailwind CSS + shadcn/ui + Recharts
- react-i18next (zh-CN, en)
- SQLite via sql.js

## Develop

Requires Node.js 22 and the project package manager.

```bash
# install dependencies, then start the dev server
# see package.json scripts: dev, build, preview
```

## Language

Repository docs and source comments are English. UI strings live in `src/i18n/locales/`.

## Privacy

The database is a sql.js file encoded in `localStorage` under `heavyscope.sqlite.v1`. Reset it from Settings.
