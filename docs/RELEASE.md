# HeavyScope v0.7.0

GitHub Releases notes. Published as a file because the GitHub MCP server has no create-release tool.

## Highlights

- Vitest coverage for burn-rate advisor math, chart aggregations, and Cursor snapshot apply.
- Apply is delta-only and hash-idempotent: the same used/total snapshot is skipped; used is never reduced.
- README documents develop, desktop packaging, Cursor snapshot JSON, and local-only privacy.
- MIT license.

## Desktop installers

- Linux `.deb` can be built locally with the tauri build script.
- macOS menu-bar `.app` / `.dmg` must be built on a Mac.
- Generate icons from `src-tauri/app-icon.svg` before bundling if you change the mark.

## Known gaps

- No signed macOS binary in this release (needs a Mac).
- Cursor adapter is snapshot import only. There is no live Cursor API.
- Grok adapter remains reserved.

## Verify

Run the test script and the production build on Node 22.
