# HeavyScope release notes

GitHub Releases notes. Published as a file because the GitHub MCP server has no create-release tool.

## v0.20.0

- First-run (Cursor not connected): dashboard subtitle tells you to open Settings, paste `WorkosCursorSessionToken`, then refresh Models / Other / Grok Bot. **Open Settings** jumps to Data sources.
- Settings opens with Data sources at the top. Language, theme, and alert thresholds are below.
- Connected Cursor keeps the short local remaining-quota subtitle.
- Normal-mode toolbar: Refresh now is the primary action. Edit is secondary. Record usage and Add pool are in More. No grip in normal mode.
- Empty Recent lists show one empty-state sentence instead of hiding the block.
- Version 0.20.0.

## v0.19.0

- Production web live refresh via same-origin `/proxy/cursor`, `/proxy/grok`, `/proxy/grok-cli` (Vite + Vercel Edge rewrite). Forwards `X-HeavyScope-Cookie` / `X-HeavyScope-Authorization`. Tokens are never logged.
- Without a proxy, zh-CN + en tell the user to use the desktop app or `pnpm dev` (not only the English CORS sentence).
- Advisor: zero usage or never-applied pools are not waste. Unconnected Grok Heavy is not ranked as tightest.
- Unsynced presets show 待连接 / Not connected instead of a placeholder `0/400` bar. After a successful apply, numbers show.
- Version 0.19.0.

## v0.18.0

- Quota overview stays short and scrollable (`max-h-16`). Sync status lines stay in that box. The title row stays full width.
- Recent records amounts go through `formatAmount` (max two decimals; integers / request counts use 0). The list is a fixed ~4–6 row scroller and does not grow the card.
- Demo is gone from the product: no Settings “Load demo data”, no first-open demo seed. Charts / History still hide leftover `source=demo` rows unless History filters for Demo. `demoSeed.ts` remains a test fixture.
- Normal mode has no grip / size / hide. PoolCard edit / delete only in Edit mode.
- Version 0.18.0.

## v0.17.0

- Edit-mode widget drag uses a live insertion slot: other cards slide aside while the pointer is down. Top / first half of a card inserts before it; bottom / second half inserts after. Drop writes `dashboard_layout`; Escape or leaving the window cancels.
- The grip is still the drag handle. Normal mode is not draggable. Hidden tiles stay in the layout array. No new drag dependency.
- Version 0.17.0. No adapter, heatmap algorithm, pie-logic, size-span, or default `/tray` layout changes.

## v0.16.0

- Web dashboard title row (h2 + action buttons) stretches to the same width as the widget grid. Quota overview stays short and scrollable (`max-h-16`). The old `max-w-xl` wrapper no longer cuts the title to the left half.
- Full / Tall cards fill their grid tiles: `h-full w-full min-w-0` on PoolCard, AdvisorPanel, ChartCard, and PiesPanel roots. Advisor `max-w-3xl` is gone so a Full card is no longer a narrow strip. `sm` stays one column; span meaning is unchanged.
- Same-row `items-stretch` still applies. Card edges sit flush with the tile. Edit chrome (grip / size / hide) stays overlay-only in Edit mode.
- Version 0.16.0. No adapter, heatmap, pie-logic, drag, or `/tray` changes.

## v0.15.0

- Daily Activity heatmap first paint no longer uses 0×0 cells. Squares stay 1:1; leftover is padding or horizontal scroll. Hover lists every pool that day and portals out of overflow.
- Pies: `sm`/`md` used pie only; `lg`/`xl` keep used + remaining. Version 0.15.0.

## v0.14.0

- Cursor Spending live sync: a saved `WorkosCursorSessionToken` can fill Grok Bot, Cursor Models, and Cursor Other $400 without a Grok cookie/bearer.
- Other is USD (`planUsage.totalSpend` / `limit`, default $400), not `apiPercentUsed` as 0–100%. Models stay a % pool from `autoPercentUsed`.
- Grok Bot is mapped only from a real Bot/API/Agents SKU row. Missing row → unavailable. Composer / Cursor Grok / Heavy are excluded. Grok.com connect stays as a supplement.
- HTTP 401/403 marks the Cursor session expired. Version 0.14.0.

## v0.13.0

- macOS `/tray` product polish: every Layout-visible pool appears in the default list (scroll; no 1–2 cap). Tightest 1–2 stay highlighted. Hidden tiles stay hidden.
- Heatmap cells stay square via `squareCellPx` (8–10px on the tray). Horizontal overflow scroll for heatmap and Settings fields.
- Menu-bar popup ~380×780. Settings pane still connects Cursor / Grok with the same keys, including Grok `Api → Grok Bot`. Accessory policy unchanged.
- Version 0.13.0.

## v0.12.0

- Web polish: Grok Bot auto-tracks from CLI billing `productUsage: Api` when a Bearer is saved. Heatmap cells stay square. Quota overview and Recent records scroll. Pies drop labels when compact.
- GetGrokCreditsConfig walks field 7 `product_usage`. Heavy stays on `creditUsagePercent`.
- Purple primary for light and dark. Version 0.12.0. No Tauri behavior change.

## v0.11.0

- Compact `/tray` is a menu-bar plugin, not a shrunk website: Refresh now, Settings gear, 1–2 expandable pool rows, last-sync lines, optional tiny heatmap.
- Tray Settings pane (same 380×520 popup) connects Cursor / Grok with the same local keys and interval as the web Data sources card. Saving a token starts the timer immediately.
- Layout Edit / Done stays secondary. Accessory policy, 380×520 size, and `optimizeDeps.include: ["sql.js"]` are unchanged.
- Version 0.11.0.

## v0.10.0

- Usable web dashboard: stable 4-column widget grid, live + manual charts, credential-based auto-refresh, Grok parsed-product diagnostics.
- Version 0.10.0. Tray feature-parity landed in 0.11.0.

## v0.9.0

- Widget dashboard: advisor, heatmap, trend, and every pool are independent cards. Edit / Done mode reorders, resizes (`sm` / `md` / `lg` / `xl`), and hides cards. Layout persists as `dashboard_layout`; old chart prefs migrate.
- Compact `/tray` has a 2-column widget grid and its own `tray_layout`.
- Daily Activity heatmap uses GitHub contribution greens for light and dark.
- Version 0.9.0.

## v0.8.0

- Live Cursor and Grok usage sync. Users paste their own `WorkosCursorSessionToken` and/or grok.com session/bearer once. Tokens stay in the local settings table, never in usage notes or backup JSON.
- Cursor maps unofficial `GET /api/usage-summary` Auto/Other percent pools. Grok maps SuperGrok Heavy `credit_usage_percent` from GetGrokCreditsConfig. Grok Bot is not invented when the proto has no Bot/Agents segment.
- CORS: Vite `/proxy/cursor` + `/proxy/grok` for `pnpm dev`; Tauri `@tauri-apps/plugin-http` for the desktop shell. Production web pages show a clear error.
- Optional macOS-only read of Cursor `state.vscdb`. Linux CI compiles a stub. See docs/MACOS.md.
- Version 0.8.0. Snapshot import, manual CRUD, sql.js Vite include, and fallbackLng stay.

## Unreleased (0.7.6 leftover)

- Settings → Local data: Paste JSON fills the import textarea from the clipboard (`navigator.clipboard.readText`). Success and failure flash in zh-CN / en. A pending flash shows immediately; `readText` is raced against a 3s timeout (timeout is treated as failure). Does not auto-apply.
- Settings → Local data: Copy JSON writes the same backup payload to the clipboard (`navigator.clipboard.writeText`). Success and failure flash in zh-CN / en. Version stays 0.7.6.

## v0.7.6

- Native browser confirm dialogs are gone. Delete pool, reset local database, demo re-apply, import, and import replace-all use in-app AlertDialogs with zh-CN / en titles and actions. First-time demo seed applies immediately; a second load still confirms because `demo_seeded=1`.
- Version 0.7.6. JSON backup, demo seed, displayPoolName, sql.js Vite include, Tauri sources, and CI are unchanged.
- English README now documents dashboard + burn rate advisor, charts/history, settings (thresholds, pools, language), Cursor snapshot import, JSON backup export/import, demo seed, Tauri 2 tray, in-app confirm dialogs, how to run, the macOS build-on-Mac note, snapshot + backup formats, and privacy.

## v0.7.5

- Settings → Local data can load demo usage for the four preset pools (last 10 days, English notes) so charts and the advisor look alive. A second load needs confirm because `demo_seeded=1`.
- Version 0.7.5. JSON backup export/import, displayPoolName, sql.js Vite include, Tauri sources, and CI are unchanged.

## v0.7.4

- Settings → Local data can export and import `heavyscope-backup.json` (`version`, `exportedAt`, `pools`, `usage_records`, `settings`) from the current sql.js tables. This is not a wasm / binary dump.
- Merge is the default: pools upsert by id (imported wins), usage records insert if the id is unknown, settings keys merge. Language is not wiped unless the file includes it. Optional replace-all requires a second confirm.
- Version 0.7.4. displayPoolName, sql.js Vite include, Tauri sources, and CI are unchanged.

## v0.7.3

- Preset pool display names go through i18n (`displayPoolName`). The four presets (preset-grok-heavy, preset-grok-bot, preset-cursor-models, preset-cursor-other) have en / zh-CN labels. Stored `pool.name` stays the English identifier. Custom pools still show `pool.name` as-is. No database rewrite.
- Version 0.7.3. sql.js Vite include, Tauri sources, and CI are unchanged.

## v0.7.2

- React class ErrorBoundary around the app. Render crashes show a bilingual ErrorState fallback; Reset reloads the page.
- Sample Cursor snapshot at `docs/cursor-snapshot.example.json` (fake demo numbers, marked SAMPLE ONLY).
- Version 0.7.2. Settings About reads Vite `__APP_VERSION__` from package.json (no leftover 0.5.0).

## Desktop installers

- Linux `.deb` can be built locally with the tauri build script.
- macOS menu-bar `.app` / `.dmg` must be built on a Mac.
- Generate icons from `src-tauri/app-icon.svg` before bundling if you change the mark.

## Known gaps

- No signed macOS binary in this release (needs a Mac and codesign).
- Live connectors use unofficial dashboard endpoints that may change.
- Grok Bot still needs a confirmed product-breakdown field; calibrate manually when unmarked.
- Cursor adapter snapshot import remains as fallback.
- No Windows installer.

## Verify

Run the test script and the production build on Node 22.
