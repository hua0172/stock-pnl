Status: ready-for-agent

# Symbol Name Display

## Problem Statement

Every screen in this app shows a bare stock symbol (`2330`, `009816`, `VOO`) with no company/fund name attached. The user has to already know what each symbol means; there's no way to glance at the report and recognize a holding by name.

## Solution

Look up each symbol's name — Chinese for TW-market symbols (from Taiwan's public exchange data), English for US-market symbols (from Yahoo Finance, which has no Chinese name data at all) — and display it as `名稱（代號）` everywhere a symbol currently appears: the report table, the Return Rate and Holding Allocation charts, the transaction and dividend lists, both audit-log history pages, and (live, as you type) the add/edit forms for both transactions and dividends. A failed or missing name lookup never blocks anything — it's purely cosmetic, so the display just falls back to the bare symbol, same as the existing behavior today.

## User Stories

1. As the user, I want to see a TW-market holding's Chinese name (e.g. 009816 → 凱基台灣TOP50) wherever its symbol appears, so I can recognize what I'm looking at without memorizing every code.
2. As the user, I want a US-market holding's English name (e.g. VOO → Vanguard S&P 500 ETF) shown the same way, since no free Chinese-name data source exists for US securities.
3. As the user, I want the format to always be `名稱（代號）` — name first, symbol in parentheses after — consistently across every screen.
4. As the user, I want this on the report page's per-stock table, so I can recognize each row at a glance.
5. As the user, I want this on the Return Rate bar chart's category labels and the Holding Allocation pie chart's slice names/legend, even though these labels are now longer than a bare symbol.
6. As the user, I want this on the transaction list and dividend list pages.
7. As the user, I want this in the transaction and dividend audit-log history pages, wherever a symbol is mentioned in a change summary.
8. As the user, I want to see the matched name appear right in the add/edit transaction and add/edit dividend forms, as soon as I finish typing a symbol (on blur), so I can catch a typo before saving rather than after.
9. As the user, I want a failed or unmatched name lookup to never block saving a transaction or dividend — the name is cosmetic, unlike the FX rate (which is real data the calculation needs and already blocks a save when it can't be resolved). A symbol with no matched name just displays as the bare symbol, exactly like today.
10. As the user, I want TW-market lookups to check the Taiwan Stock Exchange (listed/`.TW`) data first and fall back to the Taipei Exchange (OTC/`.TWO`) data if not found there, mirroring how this app already resolves `.TW`/`.TWO` for live prices.

## Implementation Decisions

- **New module, `src/lib/symbol-name.ts`**:
  - `fetchTwSymbolNames(): Promise<Map<string, string>>` — fetches Taiwan's public, unauthenticated open-data endpoints once per call: TWSE's `STOCK_DAY_ALL` (`https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL`, fields `Code`/`Name`) for listed securities, and TPEx's `tpex_mainboard_quotes` (`https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes`, fields `SecuritiesCompanyCode`/`CompanyName`) for OTC securities not found in the TWSE set. Returns one merged `Code → Chinese name` map — a single bulk fetch, not one call per symbol, since both endpoints return their entire day's list in one response.
  - `fetchUsSymbolName(symbol: string): Promise<string | null>` — reuses the existing Yahoo Finance chart endpoint (already called for live prices) and reads `meta.shortName` from the same response; returns `null` if unavailable.
  - `fetchSymbolNames(pairs: { market: Market; symbol: string }[]): Promise<Partial<Record<string, string>>>` — the combined entry point pages use: fetches the TW bulk map once (only if the input contains any `TW` pairs) and looks up each `TW` symbol in it; fetches each distinct `US` symbol's name individually (in parallel, matching the existing `Promise.allSettled` pattern already used for live prices in `page.tsx`). Missing entries are simply absent from the returned record — mirrors the existing `currentPrices: Partial<Record<string, number>>` convention already used throughout this codebase, so callers handle a missing name exactly like they already handle a missing price.
  - `formatSymbolLabel(symbol: string, name: string | undefined): string` — the one pure, testable seam this feature centers on: returns `` `${name}（${symbol}）` `` when a name is present, otherwise just `symbol` unchanged (today's behavior).
- **`src/lib/yahoo.ts`**: extend `YahooChartResult`'s `meta` type to include `shortName?: string` (Yahoo already returns this field; the current type just doesn't declare it) — no change to `fetchYahooChart`'s behavior, only its declared return shape.
- **Report page (`page.tsx`) and charts (`report-charts.tsx`)**: fetch `symbolNames` alongside the existing `currentPrices`/`currentFxRates` fetch (same `{market, symbol}` pairs already being iterated for prices), and render every `s.symbol` cell via `formatSymbolLabel(s.symbol, symbolNames[s.symbol])`. In the charts, extend the data shape `pickNonNull` produces (currently `{ symbol: string; value: number }`) with a computed `label` field (the formatted name+symbol string), and point the bar chart's `XAxis dataKey` and the pie chart's `nameKey`/legend at `label` instead of the bare `symbol`.
- **Transaction list (`transactions/page.tsx`) and dividend list (`dividends/page.tsx`)**: same pattern — fetch names for the distinct symbols on the page, format each row's symbol cell.
- **Add/edit transaction and dividend forms**: a new Server Action, `lookupSymbolName(market, symbol): Promise<string | null>`, called from a small client-side handler on the symbol input's blur event. The resolved name (or nothing, if unmatched or the lookup fails) is shown next to the input — this is a new "live, non-blocking async lookup on a form field" interaction pattern not used anywhere else in this codebase yet. A failed lookup is swallowed silently (shows no name) and never prevents the form from being submitted.
- **Audit-log history pages (`transactions/history/page.tsx`, `dividends/history/page.tsx`)**: `describeAuditEntry` (`src/lib/audit-log.ts`) and `describeDividendAuditEntry` (`src/lib/dividend-audit-log.ts`) both gain an optional `names: Partial<Record<string, string>>` parameter, used to format the symbol wherever their generated summary text currently embeds the bare symbol (e.g. `新增交易：2330（台股）...` becomes `新增交易：台灣積體電路（2330）（台股）...`). The history pages fetch names for every distinct symbol appearing across all their audit entries and pass the map through.
- **No schema changes** — names are fetched live, never persisted; `Transaction`/`Dividend`/their audit-log tables are untouched.

## Testing Decisions

- **`formatSymbolLabel`** (new, pure, dedicated test file `symbol-name.test.ts`): returns `名稱（代號）` when a name is given; returns the bare symbol unchanged when the name is `undefined`.
- **`describeAuditEntry` / `describeDividendAuditEntry`** (existing seams, `audit-log.test.ts` / `dividend-audit-log.test.ts` extended): new cases confirming the summary text includes the formatted name when a name is supplied, and falls back to the bare symbol (today's existing behavior, unchanged) when no name is supplied for that symbol — prior art is every existing case in both files, which already assert exact summary text.
- **No dedicated tests for `fetchTwSymbolNames`, `fetchUsSymbolName`, `fetchSymbolNames`, or `lookupSymbolName`** — these are network-calling functions, consistent with how `fetchCurrentPrice`/`fetchHistoricalFxRate`/`fetchYahooChart` are already handled in this codebase (verified manually, not unit tested).
- **No dedicated tests for the form's blur-lookup UI or any page's rendering** — verified manually in the browser: a known TW symbol shows its Chinese name, a known US symbol shows its English name, an unmatched/typo'd symbol shows only the bare code, and a failed lookup never blocks saving.

## Out of Scope

- Any manually-entered or user-editable name override (e.g. for US symbols, or to correct a name the user disagrees with) — names are always looked up live, never stored or user-editable, per this round's decision.
- Caching or persisting looked-up names — every page fetch resolves them fresh, mirroring how prices/FX rates already work.
- CSV import gaining any name-related column or behavior.
- Any change to `calculatePnl`'s actual P&L math, or to the `Transaction`/`Dividend` Prisma schema.

## Further Notes

- Applying this to the audit-log history pages is worth flagging: those pages describe what a transaction or dividend *was* at the moment it was created/edited/deleted — a genuinely historical record. Grafting a *live-looked-up* company name onto that historical text is a small tension (the name shown reflects today's data, not necessarily anything true "at the time"), unlike every other field in those summaries, which are frozen snapshots. This round's explicit instruction was to apply the name format everywhere without exception, so history pages are included — but a future reader wondering why an audit-log summary displays present-tense enrichment on top of a snapshot should know this was a deliberate, discussed trade-off, not an oversight.
- This spec was synthesized from a `/grill-with-docs` session held in this same conversation — see that session for the full reasoning behind each decision, including the confirmed TWSE/TPEx endpoint research.
