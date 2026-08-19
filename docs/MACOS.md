# macOS verification

HeavyScope's tray / menu-bar shell and the optional Cursor `state.vscdb` helper must be checked on a real Mac. Linux CI compiles a stub for the helper and does not read anyone's Cursor database.

## Tray / menu bar (out of scope for 0.8.0 live sync)

Build on a Mac:

```bash
pnpm install
pnpm tauri build
```

Confirm:

1. The app appears as a menu-bar / tray icon.
2. Left-click opens the window.
3. Close hides to tray; Quit exits.
4. The tray tooltip can show the hottest local pool percent.

Signed / notarized binaries need Apple certificates. This repo does not produce those on Linux.

## Optional Cursor `state.vscdb` token read

The desktop command `read_cursor_session_token` is **macOS-only** and **read-only**. It never writes Cursor's database.

Path:

`~/Library/Application Support/Cursor/User/globalStorage/state.vscdb`

Key: `cursorAuth/accessToken` in `ItemTable`.

The JWT `sub` claim plus the token become `WorkosCursorSessionToken` as `sub::jwt`. Already-formed `user_…::eyJ…` and `user_…%3A%3AeyJ…` values are accepted as-is.

On a Mac desktop build, Settings → Data sources → Cursor live connect can use **Read from Cursor app (Mac)**. macOS may require Full Disk Access if another app's Application Support is blocked.

If the helper is missing or fails, paste `WorkosCursorSessionToken` from cursor.com cookies instead. Linux and Windows builds return a clear error and still compile.
