# Native Swift menu-bar app (0.28.0)

HeavyScope now ships a **native SwiftUI menu-bar extra** under `macos/`, inspired by the public CodexMeter architecture (`Package.swift` Core + `MenuBarExtra` app). The Vite + Tauri 2 tray remains in the repo for the web / existing desktop shell.

This Linux cloud agent cannot run `xcodebuild` or verify the Mac UI. Open `macos/HeavyScope.xcodeproj` on a Mac.

## What is in this slice

- Accessory app (`LSUIElement`): click the status item for a popover with four quotas
- Dual-ring indicator: outer remaining of the selected / tightest pool; inner time-to-reset when known
- Per-pool remaining + time bars, reset countdown, and pace when timing is known
- Compact Quota History + Daily Activity links, full history window, local heatmap
- SQLite snapshots (`changes` + 15-minute unchanged anchors) in Application Support
- Settings: Keychain tokens/cookies, refresh interval, EN / zh-Hans
- Refresh on launch, default 60s, and manual refresh; last-good snapshot on failure

## Honest mapping (same as TypeScript 0.23–0.27)

| Pool | Source | Rule |
| --- | --- | --- |
| Grok Heavy | grok.com `GetGrokCreditsConfig` / CLI billing JSON | weekly `creditUsagePercent` |
| Grok Bot | Cursor `POST /api/dashboard/get-sand-usage-status` | `usagePercent` weekly % of 100. No invented counts. grok.com `GROK_CHAT` is not Bot |
| Cursor Models | `planUsage.autoPercentUsed` | percent of 100 |
| Cursor Other Models | `planUsage.apiPercentUsed` | **not** `totalSpend`. `$400` / `includedAmountCents` is cap copy only |

HTTP 401 `Team ID is required` and HTTP 405 are `http`, not session expired.

## Verify on a Mac (not done here)

- [ ] `swift test --package-path macos`
- [ ] Xcode Run: no Dock icon, status item with dual ring
- [ ] Paste `WorkosCursorSessionToken` + optional grok cookies; Refresh fills connected pools
- [ ] Failure keeps last-good numbers and shows stale copy
- [ ] History / heatmap stay empty until local snapshots exist

See [macos/README.md](../macos/README.md) and [docs/MACOS.md](MACOS.md) for the Tauri accessory checklist.
