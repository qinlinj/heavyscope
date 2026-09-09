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

Critical mapping contracts match sibling `docs/NATIVE_MAC_MAPPING.md` (PR #29) and Coding Bot’s 0.27 table. This package does not edit `src/adapters/**`.

- Cursor Models = `preset-cursor-models` / `autoPercentUsed` (period POST, usage-summary fallback)
- Other Models = `preset-cursor-other` / `apiPercentUsed` only — never `totalSpend` / `plan.used` / `onDemand.used`
- Grok Bot = `preset-grok-bot` / SAND `usagePercent`; do not loosen `isGrokBotSKU` (`cursor-grok-*` is chat)
- Grok Heavy = `preset-grok-heavy` / proto field 1 `credit_usage_percent` (CLI JSON supplement)
- HTTP 401 `Team ID is required` and HTTP 405 are `http`, not session expired

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
