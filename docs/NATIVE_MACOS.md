# Native Swift menu-bar app (0.28.0)

HeavyScope now ships a **native SwiftUI menu-bar extra** under `macos/`, inspired by the public CodexMeter architecture (`Package.swift` Core + `MenuBarExtra` app). The Vite + Tauri 2 tray remains in the repo for the web / existing desktop shell.

This Linux cloud agent cannot run `xcodebuild` or verify the Mac UI. Open `macos/HeavyScope.xcodeproj` on a Mac.

## What is in this slice

Leader UX (status item + popover A–E):

- Menu-bar icon: dual ring — outer remaining% of the tightest **connected** pool (preset color), inner time-to-reset when known, short integer remaining% label. Unconnected pools never drive the icon. Stale keeps last good.
- Popover (~360 wide, hairline dividers, no card stack): **A** Refresh + Settings · **B** hero used% of tightest connected (dot + short name + reset + pace) · **C** Models → Other → Bot → Heavy compact rows · **D** mini remaining% curves + % burn activity · **E** last synced. Heatmap at the bottom only (1:1, brand purple, no tooltip).
- Settings may hide History / Activity. Pool rows cannot be emptied or reordered. No Layout/Done. No Day/Week/Month heatmap binding.
- SQLite snapshots, Keychain, EN / zh-Hans, refresh on launch / 60s / manual

## Honest mapping (Coding Bot / 0.27 accepted table)

Canonical field map: sibling [docs/NATIVE_MAC_MAPPING.md](https://github.com/xiaotonz/heavyscope/blob/cursor/native-mac-mapping-8ca6/docs/NATIVE_MAC_MAPPING.md) (PR #29). This PR does **not** change TypeScript adapters, Tray, or the web UI.

| Pool | preset id | poolHint | Field | Do not map |
| --- | --- | --- | --- | --- |
| Cursor Models | `preset-cursor-models` | `cursor_models` | `planUsage.autoPercentUsed` (period POST, usage-summary fallback). `%` / 100. Reset `billingCycleEnd` | `apiPercentUsed` |
| Cursor Other | `preset-cursor-other` | `cursor_other` | `planUsage.apiPercentUsed` only. `%` / 100. Reset `billingCycleEnd`. `$400` = `includedAmountCents` copy | `totalSpend`, `plan.used` cents, `onDemand.used` |
| Grok Bot | `preset-grok-bot` | `grok_bot` | SAND POST `{}` `usagePercent`. `%` / 100. remaining = clamp(100 − %). Reset `nextResetTimestampUtc`. SAND over SKU $ | grok.com `GROK_CHAT` / `product_usage` enum; `cursor-grok-*` chat |
| Grok Heavy | `preset-grok-heavy` | `grok_heavy` | proto field 1 fixed32 `credit_usage_percent`; CLI `creditUsagePercent` supplement. `%` / 100. Reset period end | treating Heavy product rows as Bot |

Cursor: `WorkosCursorSessionToken` + Origin/Referer cursor.com. 401 real auth → `expired`; 405 and `Team ID is required` → `http`. Grok: session cookie and/or Bearer.

## Verify on a Mac (not done here)

- [ ] `swift test --package-path macos`
- [ ] Xcode Run: no Dock icon, status item with dual ring
- [ ] Paste `WorkosCursorSessionToken` + optional grok cookies; Refresh fills connected pools
- [ ] Failure keeps last-good numbers and shows stale copy
- [ ] History / heatmap stay empty until local snapshots exist

See [macos/README.md](../macos/README.md) and [docs/MACOS.md](MACOS.md) for the Tauri accessory checklist.
