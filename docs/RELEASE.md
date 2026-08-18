# HeavyScope v0.7.1

GitHub Releases notes. Published as a file because the GitHub MCP server has no create-release tool.

## Highlights

- GitHub Actions CI: Node 22, package manager from packageManager, test and build on push/PR to main.
- Visible error state if the local sql.js database fails to open.
- Quota cycle rollover: overdue pools reset used quota, advance reset_at, and keep usage history.
- History date inputs stay browser-native, with an i18n hint.

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
