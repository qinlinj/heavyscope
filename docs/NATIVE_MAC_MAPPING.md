# Native Mac four-pool mapping (0.27)

HeavyScope stores **four preset pools**. A CodexMeter-style Swift menubar must stay honest with live sync: never invent used / remaining / limit, and never map `totalSpend` to Other. Source of truth: `src/adapters/cursorLive.ts`, `grokLive.ts`, `liveConstants.ts`. See [CHANGELOG 0.27.0](../CHANGELOG.md#0270---2026-08-21).

## Table

| Pool | preset id | poolHint | Source API | Field | Unit / total | Reset | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Grok Heavy | `preset-grok-heavy` | `grok_heavy` | POST grok.com `GetGrokCreditsConfig` (gRPC-web) | `credit_usage_percent` | % / 100 | period end | CLI billing `creditUsagePercent` OK as supplement; not Bot |
| Grok Bot | `preset-grok-bot` | `grok_bot` | POST cursor.com `/api/dashboard/get-sand-usage-status` body `{}` | `usagePercent` | % / 100 | `nextResetTimestampUtc` | SAND preferred; SKU rows fallback only; no fake absolute counts |
| Cursor Models | `preset-cursor-models` | `cursor_models` | POST `/api/dashboard/get-current-period-usage` (`planUsage`) or GET `/api/usage-summary` | `autoPercentUsed` | % / 100 | `billingCycleEnd` | Auto / Composer / Cursor Grok chat |
| Cursor Other | `preset-cursor-other` | `cursor_other` | same period/summary `planUsage` | `apiPercentUsed` | % / 100 | `billingCycleEnd` | Included in Ultra / Other Models. **Not** `totalSpend`. `$400` = `includedAmountCents` copy only |

## Do not map

- `planUsage.totalSpend` / `includedSpend` / `plan.used` cents → not Other
- `onDemand.used` when disabled → not Other used
- `apiPercentUsed` → not Models; `autoPercentUsed` → not Other
- grok.com `GROK_CHAT` / unnamed `product_usage` alone → not Bot
- `cursor-grok-*` model SKUs → not Bot (`isCursorGrokBotSku` rejects them)

## HTTP honesty

- Cursor: 401/403 `expired` only on a real auth rejection; 405 = `http`; `Team ID is required` = `http` (keep Models/Other)
- SAND GET = 405; use POST `{}`
- Grok gRPC-web status 16 / `unauthenticated` → needs Bearer

## Auth headers

- Cursor: Cookie `WorkosCursorSessionToken`; Origin `https://cursor.com`; Referer spending dashboard
- Grok: Cookie and/or `Authorization: Bearer`

## Accent colors (display only)

Heavy `#38bdf8` · Bot `#a78bfa` · Models `#34d399` · Other `#fbbf24`
