# macOS menu-bar accessory

HeavyScope's Tauri 2 desktop shell is a **menu-bar extra** on macOS (`NSApplicationActivationPolicyAccessory`). It must be built and verified on a real Mac. This Linux/web environment cannot produce a `.app` or `.dmg`.

The web app is unchanged. `src-tauri/Info.plist` already sets `LSUIElement`. Rust adds `ActivationPolicy::Accessory` and positions a compact panel under the status item on top of that plist — it does not replace it. Linux/Windows keep the 980×720 centered tray window (`tauri.conf.json`) and still compile (`cfg(target_os = "macos")` in `src-tauri/src/lib.rs`, plus `src-tauri/tauri.macos.conf.json`).

Linux CI compiles a stub for the optional Cursor `state.vscdb` helper and does not read anyone's Cursor database.

## Build on a Mac

Requires Node.js 22, the package manager pinned in `package.json`, and a recent stable Rust toolchain that can target Darwin (current Tauri 2 crates need roughly Rust 1.85+).

```bash
pnpm install
pnpm tauri build
```

That runs `pnpm build` for the Vite frontend, then produces:

- `src-tauri/target/release/bundle/macos/HeavyScope.app`
- `src-tauri/target/release/bundle/dmg/HeavyScope_*.dmg`

Dev loop:

```bash
pnpm tauri dev
```

If you change `src-tauri/app-icon.svg` or `src-tauri/icons/tray-template.svg`, regenerate bundle icons before shipping:

```bash
pnpm tauri icon src-tauri/app-icon.svg
```

The menu-bar glyph is the monochrome template `src-tauri/icons/tray-template.png` (black + alpha). Do not replace it with the purple app mark.

`src-tauri/target` is gitignored and must not be vendored.

## Accessory checklist (verify on a real Mac)

- [ ] The app does **not** appear in the Dock.
- [ ] Activity Monitor / System Settings show an accessory / UI-element style process (`LSUIElement` + `ActivationPolicy::Accessory`).
- [ ] A template (black/white) icon sits in the menu bar. Optional percent title (tightest pool) may appear next to it.
- [ ] Left-click opens a compact 380×520 panel **anchored under the status item**, not at screen center.
- [ ] The panel has no overlapping traffic-light title-bar buttons (undecorated / overlay title hidden).
- [ ] The panel loads `/tray` (tightest 1–2 pools + advisor one-liner). Language toggle is en / 中文.
- [ ] Clicking outside the panel, or deactivating the app, hides it.
- [ ] Clicking the icon again while the panel is open hides it (no flicker-reopen).
- [ ] Right-click (or the tray menu) still offers Open and Quit.
- [ ] Quit exits; closing the panel only hides it.

Preview the compact route in a browser (no native chrome): `pnpm dev` then open `/tray`.

## Optional Cursor `state.vscdb` token read

The desktop command `read_cursor_session_token` is **macOS-only** and **read-only**. It never writes Cursor's database.

Path:

`~/Library/Application Support/Cursor/User/globalStorage/state.vscdb`

Key: `cursorAuth/accessToken` in `ItemTable`.

The JWT `sub` claim plus the token become `WorkosCursorSessionToken` as `sub::jwt`. Already-formed `user_…::eyJ…` and `user_…%3A%3AeyJ…` values are accepted as-is.

On a Mac desktop build, Settings → Data sources → Cursor live connect can use **Read from Cursor app (Mac)**. macOS may require Full Disk Access if another app's Application Support is blocked.

If the helper is missing or fails, paste `WorkosCursorSessionToken` from cursor.com cookies instead. Linux and Windows builds return a clear error and still compile.

## Codesign

This repository does not include signing certificates or secrets.

A local unsigned `.app` is enough to click-test Accessory behavior on the same Mac that built it. Gatekeeper will block that binary on other machines until you notarize.

Typical next steps on a Mac that has an Apple Developer ID (do this locally; do not commit secrets):

```bash
codesign --deep --force --options runtime --sign "Developer ID Application: Your Name (TEAMID)" \
  src-tauri/target/release/bundle/macos/HeavyScope.app
xcrun notarytool submit src-tauri/target/release/bundle/dmg/HeavyScope_*.dmg \
  --keychain-profile "notary" --wait
xcrun stapler staple src-tauri/target/release/bundle/dmg/HeavyScope_*.dmg
```

`hardenedRuntime` is already enabled in the Tauri macOS bundle config.

## Size report

Target: **under 50 MB**, ideally **20–30 MB**, for the shipped `.app` (and a similar `.dmg`).

This environment cannot emit a real Mac binary, so the numbers below are the **changes that shrink the release**, plus how to measure on a Mac.

### What this release changed for size

- Release profile in `src-tauri/Cargo.toml`: `lto = true`, `opt-level = "s"`, `strip = true`, `codegen-units = 1`.
- Tauri crate features stay at the minimum set the shell needs: `tray-icon`, `image-png` (embedded template glyph), `macos-private-api` (overlay / accessory window). `tauri-plugin-http` is for live Cursor / Grok sync, not panel positioning.
- Compact `/tray` route instead of shipping a second frontend. No vendored wasm/blobs beyond the existing sql.js web build. `src-tauri/target` is not committed.

### Measure on a Mac

After `pnpm tauri build`:

```bash
# .app directory size (what users install)
du -sh src-tauri/target/release/bundle/macos/HeavyScope.app

# Mach-O binary only
ls -lh src-tauri/target/release/bundle/macos/HeavyScope.app/Contents/MacOS/heavyscope

# Disk image
ls -lh src-tauri/target/release/bundle/dmg/HeavyScope_*.dmg
du -sh src-tauri/target/release/bundle/dmg/HeavyScope_*.dmg
```

Record the three numbers in the GitHub release notes. If the `.app` is still over 50 MB, check that you built `--release` (not `tauri dev`), that `strip` ran, and that you are not measuring `src-tauri/target` (the whole compile cache).
