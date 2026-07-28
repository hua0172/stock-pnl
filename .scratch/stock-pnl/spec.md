Status: ready-for-agent

# Stock P&L Tracker

## Problem Statement

The user trades both Taiwan-listed and US-listed stocks and currently has no single place to see how those positions are performing. Spreadsheets don't handle multi-currency conversion or weighted-average cost basis cleanly, and brokerage apps only show one market at a time. The user wants a small local system where they can log every buy/sell and get back a trustworthy, unified profit-and-loss picture — both what they've already locked in and what they're currently sitting on — without the tool leaking their personal trading data anywhere outside their own machine.

## Solution

A local-only Next.js web app backed by a SQLite file. The user records transactions (Taiwan or US market, buy or sell) either one at a time through a form or in bulk through a CSV file in a fixed, documented format. For every transaction, the app resolves the TWD/foreign-currency exchange rate for that trade's date automatically (Taiwan-market trades are already TWD, so this is a no-op for them) and stores it alongside the trade. A report page shows an overview (total realized P&L, total unrealized P&L, combined total — all in TWD) and a per-stock breakdown (weighted-average cost, quantity held, realized/unrealized P&L, with the original-currency amount shown as a secondary reference for US positions). Unrealized P&L is marked to the stock's current price, fetched live from Yahoo Finance.

## User Stories

1. As a user, I want to manually add a buy transaction (market, symbol, trade date, quantity in shares, price in the market's original currency), so that I can record a trade as it happens.
2. As a user, I want to manually add a sell transaction the same way, so that I can record closing part or all of a position.
3. As a user, I want the system to automatically resolve the TWD exchange rate for a US-market transaction's trade date, so that I never have to look up or type in a rate myself.
4. As a user, I want Taiwan-market transactions to be treated as already denominated in TWD (an implicit 1.0 rate), so that domestic trades never trigger an unnecessary FX lookup.
5. As a user, I want to bulk-import historical trades via a CSV file in a documented, broker-agnostic format, so that I don't have to hand-retype years of trade history.
6. As a user, I want CSV import to validate every row independently and tell me exactly which rows failed and why, so that one malformed row doesn't silently corrupt the import or block the rows that are fine.
7. As a user, I want an overview report showing total realized P&L, total unrealized P&L, and their sum, all converted to and totalled in TWD, so that I get one trustworthy top-line number.
8. As a user, I want a per-stock breakdown showing quantity held, weighted-average cost, realized P&L, and unrealized P&L for each symbol, so that I can see how each position is doing individually.
9. As a user, I want US-market rows in the per-stock breakdown to also show the original USD amount next to the TWD figure, so that I have a reference back to the currency I actually traded in.
10. As a user, I want unrealized P&L calculated against the stock's current market price pulled live from Yahoo Finance, so that my paper gains/losses reflect where the market actually is right now, not a stale number.
11. As a user, I want cost basis on partial sells calculated with the weighted-average-cost method (not FIFO), so that the numbers match the convention I'm used to from Taiwanese brokerage apps.
12. As a user, I want P&L to be calculated as sell amount minus buy amount only (no brokerage fees, no securities transaction tax deducted), understanding that the displayed number is gross, not net of trading costs.
13. As a user, I want all my holdings treated as one unified portfolio with no brokerage-account subdivision, so that the data model and every form stay simple.
14. As a user, I want quantities stored uniformly in shares for both markets (never "張"/board lots), so there's no market-specific unit-conversion logic anywhere in the system.
15. As a user, I want the whole app — server, database, everything — to run entirely on my own machine, so that my personal trading data never leaves my computer.
16. As a user, I want my transaction history to persist across app restarts (a real SQLite file on disk, not in-memory), so that I don't lose data between sessions.
17. As a user, I want the report to always reflect the latest data whenever I add or import a transaction, so that I never have to wonder if I'm looking at a stale view.
18. As a user, I want the CSV column format documented plainly (trade date, market, symbol, side, quantity, price), so that I can prepare an import file myself regardless of which broker I actually use — the app doesn't parse any specific broker's native export.
19. As a user, I want to be told clearly if an external data source (the FX-rate lookup or the Yahoo Finance price lookup) fails or is unreachable, rather than have the app silently show a wrong or zeroed-out number as if it were correct.
20. As a user, I want a fully-sold (zero remaining quantity) position to still appear in the per-stock breakdown with its historical realized P&L, so that closed positions don't just disappear from the report.

## Implementation Decisions

- **Stack**: Next.js (App Router, TypeScript, Tailwind) + Prisma + SQLite, already scaffolded at the repo root.
- **Schema** (`prisma/schema.prisma`, already written): single `Transaction` model — `id`, `tradeDate` (DateTime), `market` (enum `TW`/`US`), `symbol` (String), `side` (enum `BUY`/`SELL`), `quantity` (Float, shares), `price` (Float, in the market's original currency), `fxRate` (Float, TWD per 1 unit of that transaction's currency — `1.0` for TW), `createdAt`. No account/broker field, no fee/tax fields, by design (see User Stories 12–13).
- **Modules**:
  - `src/lib/pnl.ts` — `calculatePnl(transactions, currentPrices, currentFxRates) → Report`. Pure function, no I/O. This is where the weighted-average-cost logic and TWD conversion live.
  - `src/lib/csv.ts` — `parseTransactionsCsv(csvText) → { transactions, errors }`. Pure function, no I/O.
  - `src/lib/yahoo.ts` — shared internal helper hitting Yahoo Finance's unofficial chart endpoint (`query1.finance.yahoo.com/v8/finance/chart/{symbol}`), used by both `fx.ts` and `price.ts` below. Server-side only — Yahoo does not send permissive CORS headers, and the endpoint is unofficial/unversioned, so treat failures as expected and surface them (User Story 19) rather than assuming five-nines uptime.
  - `src/lib/fx.ts` — USD/TWD rate via the `TWD=X` symbol on the same Yahoo Finance endpoint (`range=max` covers arbitrary historical dates, closest trading day at/before the requested date). Replaces two earlier candidates, both rejected after verification: Bank of Taiwan's rate.bot.com.tw (capped at ~6 months lookback, sits behind an Akamai bot challenge that blocks plain server-side fetches) and Frankfurter.app (doesn't carry TWD at all — it's ECB-sourced and TWD isn't among its 31 currencies). Consolidating onto Yahoo Finance also means the app has only one external dependency instead of two.
  - `src/lib/price.ts` — thin wrapper around the same Yahoo Finance chart endpoint for current stock price (`.TW` suffix for Taiwan tickers, current price at `chart.result[0].meta.regularMarketPrice`).
  - `src/app/lib/actions.ts` (Server Actions) — `addTransaction`, `importTransactionsCsv`. These call `fx.ts` to resolve the rate at write time, then persist via Prisma.
  - Report page (Server Component) — loads all transactions, calls `price.ts` and `fx.ts` for current-day values, calls `pnl.ts`, renders overview + per-stock table.
  - Manual-entry form page and CSV-import page, both invoking the Server Actions above.
- **Cost-basis currency**: weighted-average cost is tracked in TWD, not in the original currency. Each transaction's original-currency amount is converted to TWD using *that transaction's own* trade-date `fxRate` before being folded into the running average. This means, for US-market positions, FX movement between trade dates is implicitly part of the reported P&L (a US stock that's flat in USD but where USD strengthened against TWD since purchase will show a paper gain) — a direct consequence of the earlier decision to report everything in one TWD total (see `CONTEXT.md`, once written). Flagging this explicitly since it wasn't spelled out loudly in the original discussion — worth the user's eyes before implementation starts.
- **Realized vs. unrealized math**: on a `SELL`, realized P&L for that trade = `(sell price × sell fxRate − running weighted-average TWD cost per share) × quantity sold`. Unrealized P&L for remaining quantity = `(current price × current fxRate − running weighted-average TWD cost per share) × quantity held`. TW transactions use `fxRate = 1.0` throughout, so this collapses to plain TWD arithmetic for TW positions.
- **CSV format**: fixed columns — `trade_date` (`YYYY-MM-DD`), `market` (`TW`/`US`), `symbol`, `side` (`BUY`/`SELL`), `quantity`, `price`. The FX rate is *not* a CSV column — each imported row goes through the same `fx.ts` lookup as manual entry, so behavior is identical either way.
- **External data sources**: Yahoo Finance's unofficial chart endpoint for everything — historical and current FX (via `TWD=X`) and current stock price (via ticker, `.TW` suffix for Taiwan). Unauthenticated, no API key, called server-side only.

## Testing Decisions

- Tests target the two pure-function seams only; everything else (Server Actions, the two external HTTP wrappers) is thin glue verified manually against the running dev server, not unit-tested.
- **`calculatePnl`** (unit tests, no DB/network):
  - single buy, no sell → fully unrealized, zero realized
  - buy then full sell → fully realized, zero remaining quantity/unrealized
  - multiple buys at different prices then a partial sell → verifies the weighted-average-cost math specifically
  - a US-market buy and sell with two different `fxRate` values → verifies FX movement flows into realized P&L as described above
  - a fully-closed position (zero quantity) still reports its historical realized P&L (User Story 20)
- **`parseTransactionsCsv`** (unit tests, no DB/network):
  - a fully valid file
  - a missing required column
  - an invalid `market` or `side` value
  - a malformed date or non-numeric quantity/price
  - a file mixing valid and invalid rows — confirms per-row error reporting rather than all-or-nothing failure
- No prior art to follow — this is a new repo with no existing test suite.

## Out of Scope

- Multiple brokerage-account tracking (User Story 13 explicitly rejects this)
- Fee- and tax-inclusive net P&L (User Story 12)
- Year/month or any time-windowed report breakdown — overview + per-stock only
- Parsing any specific broker's native CSV export format
- Scraping Bank of Taiwan's rate.bot.com.tw for historical FX — investigated and rejected (6-month lookback cap, Akamai bot challenge blocks server-side fetches)
- Authentication, multi-user support, or any deployment beyond the local dev server

## Further Notes

- `CONTEXT.md` (domain glossary) and ADRs for the harder-to-reverse calls made along the way — weighted-average cost vs. FIFO, excluding fees/tax from P&L, the external data-source choices — are still outstanding and should be written per the `domain-modeling` skill, ideally alongside this implementation rather than after.
- If Frankfurter.app or the Yahoo Finance endpoint ever become unreliable, `fx.ts` and `price.ts` are each a single, isolated seam to swap out — nothing else in the codebase should need to change.
