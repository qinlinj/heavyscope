# HeavyScope v0.7.2

GitHub Releases notes. Published as a file because the GitHub MCP server has no create-release tool.

## Highlights

- React class ErrorBoundary around the app. Render crashes show a bilingual ErrorState fallback; Reset reloads the page.
- Sample Cursor snapshot at `docs/cursor-snapshot.example.json` (fake demo numbers, marked SAMPLE ONLY).
- Version 0.7.2. sql.js Vite include, Tauri sources, and CI are unchanged.

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
