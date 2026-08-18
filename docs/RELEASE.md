# HeavyScope release notes

GitHub Releases notes. Published as a file because the GitHub MCP server has no create-release tool.

## v0.7.4

- Settings → Local data can export and import `heavyscope-backup.json` (`version`, `exportedAt`, `pools`, `usage_records`, `settings`) from the current sql.js tables. This is not a wasm / binary dump.
- Merge is the default: pools upsert by id (imported wins), usage records insert if the id is unknown, settings keys merge. Language is not wiped unless the file includes it. Optional replace-all requires a second confirm.
- Version 0.7.4. displayPoolName, sql.js Vite include, Tauri sources, and CI are unchanged.

## v0.7.3

- Preset pool display names go through i18n (`displayPoolName`). The four presets (preset-grok-heavy, preset-grok-bot, preset-cursor-models, preset-cursor-other) have en / zh-CN labels. Stored `pool.name` stays the English identifier. Custom pools still show `pool.name` as-is. No database rewrite.
- Version 0.7.3. sql.js Vite include, Tauri sources, and CI are unchanged.

## v0.7.2

- React class ErrorBoundary around the app. Render crashes show a bilingual ErrorState fallback; Reset reloads the page.
- Sample Cursor snapshot at `docs/cursor-snapshot.example.json` (fake demo numbers, marked SAMPLE ONLY).
- Version 0.7.2. Settings About reads Vite `__APP_VERSION__` from package.json (no leftover 0.5.0).

## Desktop installers

- Linux `.deb` can be built locally with the tauri build script.
- macOS menu-bar `.app` / `.dmg` must be built on a Mac.
- Generate icons from `src-tauri/app-icon.svg` before bundling if you change the mark.

## Known gaps

- No signed macOS binary in this release (needs a Mac and codesign).
- Cursor adapter is snapshot import only. There is no live Cursor API.
- Grok adapter remains reserved.
- No Windows installer.

## Verify

Run the test script and the production build on Node 22.
