# HeavyScope native macOS menu bar

Menu-bar-only SwiftUI app (`LSUIElement`). This is the 0.28.0 product slice. The existing Vite / Tauri web tray in the repo root is unchanged.

Architecture follows the public CodexMeter split (Core package + SwiftUI app) for testability. UX patterns are replicated with HeavyScope data. Do not copy CodexMeter assets or Codex branding.

## Open on a Mac

```bash
open macos/HeavyScope.xcodeproj
```

Requires macOS 13+ and Xcode 15+. Run the **HeavyScope** scheme. The app is an accessory process: no Dock icon, status item only.

`xcodebuild` cannot run in this Linux cloud environment. The Mac UI is **not verified** here.

Optional: regenerate the Xcode project with [XcodeGen](https://github.com/yonaskolb/XcodeGen) from `macos/project.yml` if you prefer that workflow. The checked-in `HeavyScope.xcodeproj` is already complete.

## Core tests (Linux or Mac)

```bash
cd macos
swift test
```

`Package.swift` exposes `HeavyScopeCore` from `HeavyScope/Core`. Tests live in `Tests/HeavyScopeCoreTests`. On Ubuntu 24.04, `swift test` (Swift 5.10.1) passed 24 Core tests after installing `libsqlite3-dev`. `xcodebuild` is not available in Linux CI.

Critical mapping contracts (ported from TypeScript 0.23–0.27):

- Other Models = `planUsage.apiPercentUsed`, never `totalSpend`
- Grok Bot = SAND `usagePercent` (weekly % of 100). No invented absolute counts
- Cursor Models = `autoPercentUsed`
- HTTP 401 `Team ID is required` is `http`, not session expired
- HTTP 405 is `http`, not expired

## Layout

```
macos/
  Package.swift
  HeavyScope.xcodeproj
  HeavyScope/Core/          # testable mappers, SQLite snapshots, live client
  HeavyScope/App/           # MenuBarExtra, popover, history, settings
  Tests/HeavyScopeCoreTests/
```

Secrets use Keychain on macOS (`KeychainSecretStore`). Never commit tokens. Snapshots go to `~/Library/Application Support/HeavyScope/UsageHistory.sqlite` (changes plus a 15-minute unchanged anchor).

Refresh: launch, default 60s, and the popover refresh control. Failed fetches keep the last good snapshot and mark it stale.

## Four quotas

1. **Grok Heavy** — grok.com `GetGrokCreditsConfig` weekly `credit_usage_percent` (CLI billing JSON fallback)
2. **Grok Bot** — Cursor `POST /api/dashboard/get-sand-usage-status` → `usagePercent`
3. **Cursor Models** — `planUsage.autoPercentUsed`
4. **Cursor Other Models** — `planUsage.apiPercentUsed`. `$400` / `includedAmountCents` is cap copy only
