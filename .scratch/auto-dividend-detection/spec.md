Status: ready-for-agent

# Auto Dividend Detection

## Problem Statement

Dividend records currently have to be entered by hand for every holding, every payout. The user wants to only have to record buy/sell transactions going forward — dividends for anything they hold (TW or US) should be detected and recorded automatically.

## Solution

Once a day (gated by a persisted "last run" marker, checked opportunistically when the report page loads — no new scheduler/infra), scan for ex-dividend events on every symbol the user has ever transacted, and auto-create a `Dividend` record for any event where they held a positive quantity as of that event's date and no record for it exists yet. Auto-created records are identical in every way to manually-entered ones — same table, same edit/delete/audit-log behavior, no distinguishing marker.

Data sources (all free, unauthenticated, already the pattern this app uses):
- **TW**: TWSE's `TWT48U_ALL` (上市股票除權除息預告表) and TPEx's `tpex_exright_prepost` (上櫃股票除權除息預告表) — each row gives an ex-dividend date, symbol, and cash-dividend-per-share. Confirmed via direct query: both are a **rolling ~2-month window only** (TWSE: 2026-07-29 to 2026-10-06 as observed; TPEx similar) — there is no free historical archive further back, so this feature can only track dividends from now onward, not backfill older ones.
- **US**: the existing Yahoo Finance chart endpoint (`fetchYahooChart`'s URL, i.e. `buildYahooChartUrl`) already used elsewhere in this app, with `&events=div` appended — confirmed via direct query (`AAPL`) that this returns `{date, amount}` dividend events unauthenticated, unlike `quoteSummary` which returned `401 Unauthorized: Invalid Crumb` when tested directly.

## User Stories

1. As the user, I want any TW or US holding's dividend to be automatically recorded once its ex-dividend date and per-share amount are known, without me doing anything.
2. As the user, I want the amount recorded to reflect the shares I actually held as of the ex-dividend date — not my current holding count — so a symbol I've since partially sold or added to still gets the correct historical amount.
3. As the user, I want this to only kick in from now on — I understand older dividends (further back than the data sources' own rolling window) won't be backfilled, and I'll add those by hand myself if I want them.
4. As the user, I want auto-created dividend records to be just as editable and deletable as ones I enter by hand, in case the source data is ever wrong.
5. As the user, I want this checked automatically at most once a day, triggered by me simply using the app (opening the report page) — no separate scheduled job to set up or maintain.
6. As the user, I want a data-source hiccup on scan day to never block the report page from loading — it should just be visible the same way existing price/FX errors are, and get retried next time the scan runs.
7. As the user, I want this to cover both TW and US holdings, not just one market.
8. As the user, I want an ex-dividend event to never be double-recorded, even though the scan re-examines the same rolling window of upcoming/recent events every day.
9. As the user, I want a not-yet-fully-announced ex-dividend event (per-share amount still blank at the data source) to be skipped for now and picked up automatically on a later day once the amount is published, rather than creating a record with a wrong or zero amount.

## Implementation Decisions

- **New pure seam — `quantityHeldAsOf`** (`src/lib/pnl.ts`): `quantityHeldAsOf(transactions: TransactionInput[], asOfDate: string): number` — sum of signed quantities (`+` for BUY, `-` for SELL) across transactions with `tradeDate <= asOfDate`. Order-independent (a pure sum with a date cutoff), so no chronological sort needed. Reuses the existing `QUANTITY_EPSILON` tolerance convention when comparing the result to zero at call sites.
- **New pure seam — `shouldRunDailyScan`** (new file, e.g. `src/lib/dividend-scan.ts`): `shouldRunDailyScan(lastRunDate: string | null, today: string): boolean` — true when `lastRunDate` is `null` or strictly before `today` (plain `YYYY-MM-DD` string comparison, matching how `tradeDate` is already compared elsewhere in this app).
- **New pure seam — TW row filtering**: a function that takes the raw (already-fetched) TWSE and TPEx rows and returns normalized `{ symbol, exDate, cashDividendPerShare }` events, dropping rights-only rows (TWSE `Exdividend === "權"`, TPEx `ExRrightsExDividend === "除權"`) and rows with a blank/zero `CashDividend` (not yet announced). Confirmed field values via direct query: TWSE's `Exdividend` is one of `權`/`權息`/`息`; TPEx's `ExRrightsExDividend` is one of `除權`/`除權息`/`除息` — both `…息` variants carry an actual cash-dividend component and should be kept.
- **Schema**: new singleton table `DividendScanState { id (fixed), lastRunDate: DateTime? }` to persist the "last run" marker durably (across server restarts) — a module-level in-memory flag (like the symbol-name cache) isn't enough here since this gates a write, not just a read.
- **Prefactor**: export `createDividend` from `dividend-actions.ts` (currently private) so the new auto-detection code can reuse the exact same create-plus-audit-log logic as manual entry, rather than duplicating it.
- **Orchestration** (new module, e.g. `src/lib/dividend-detection.ts`, network-calling — not unit tested, per this repo's convention):
  - `fetchTwExDividendEvents()`: fetch `TWT48U_ALL` + `tpex_exright_prepost` in parallel, run the pure row-filter above.
  - `fetchUsExDividendEvents(symbols: string[])`: for each distinct US symbol ever transacted, fetch the Yahoo chart endpoint with `events=div` (extending `buildYahooChartUrl` to optionally include `&events=div`) over a `3mo` range, parse `chart.result[0].events.dividends` into the same normalized event shape.
  - `detectAndCreateMissingDividends()`: get every distinct `(symbol, market)` pair that has ever appeared in a transaction (not just currently-held symbols, since a symbol fully sold could still have been held as of a past ex-date within the window); fetch both markets' events; for each event, compute `quantityHeldAsOf` for that symbol's transactions, skip if not positive; skip if a `Dividend` already exists for that `(symbol, market, paymentDate)`; otherwise fetch the historical FX rate for that date and call the (now-exported) `createDividend`. Any individual data-source failure (timeout, bad response) is caught and skipped, contributing a message to the same kind of error list the report page already surfaces for price/FX failures — never thrown, never blocks the rest of the scan.
- **Report page wiring** (`src/app/page.tsx`): before the existing `dividendRows` prisma query, check `shouldRunDailyScan` against the persisted `lastRunDate`; if due, run `detectAndCreateMissingDividends()` (wrapped so any failure becomes a `dataErrors` entry, never a crash), then update `lastRunDate` to today, all before the page's own dividend/transaction queries run — so any newly auto-created dividends are reflected in that same page load's numbers.
- **No change** to the manual add/edit/delete dividend flow, its form, or its audit log shape — auto-created records are plain `Dividend` rows indistinguishable from manual ones, per the user's explicit preference.

## Testing Decisions

- `quantityHeldAsOf`: unit tested — only counts transactions on/before the cutoff date, a sell after the cutoff doesn't reduce the result, a buy after the cutoff doesn't add to it, and a full sell brings it to (epsilon-tolerant) zero.
- `shouldRunDailyScan`: unit tested — `null` → true, same-day → false, an earlier date → true.
- The TW row-filtering pure function: unit tested — a `息`/`除息` row with a cash amount is kept; a `權`/`除權` row is dropped regardless of amount; a `息`/`除息` row with a blank or zero `CashDividend` is dropped.
- No dedicated tests for `fetchTwExDividendEvents`, `fetchUsExDividendEvents`, `detectAndCreateMissingDividends`, or the report-page wiring — verified manually (confirm a real held symbol with a known upcoming ex-dividend date gets a matching `Dividend` row created after a page load, confirm re-loading the same day doesn't duplicate it, confirm a symbol with zero holdings as of the ex-date is skipped).

## Out of Scope

- Backfilling dividends older than each data source's own rolling window (~2 months for TW; Yahoo's own window for US).
- Any visual marker distinguishing auto-created from manually-entered dividend records.
- A true OS-level scheduled job (launchd timer, cron) — the trigger is strictly "checked on report-page load, at most once a day."
- Real dividend-settlement mechanics (record date vs. ex-date vs. payment date nuances beyond a simple "held as of the ex-date" cutoff) — this reuses the same same-day transaction-ordering simplification already used throughout the app (e.g. in the oversell guard), not a precise brokerage settlement model.
- Any change to how `calculatePnl` aggregates dividend income — it already sums whatever rows exist in the `Dividend` table.

## Further Notes

- Confirmed via direct queries during this grilling session: TWSE `TWT48U_ALL` returned 113 rows spanning 2026-07-29 to 2026-10-06; TPEx `tpex_exright_prepost` returned 121 rows spanning 2026-07-22 to 2026-09-07; Yahoo's `chart?events=div` for `AAPL` returned dividend events unauthenticated while `quoteSummary` returned `401`.
- User confirmed: TW ex-dividend "prepost" table (not the broader, date-less "dividend distribution status" table) as the TW data source; both TW and US in scope; auto-created records fully editable/deletable like manual ones; trigger is report-page-load-gated, at most once a day; the ~2-month (TW) rolling-window limitation and lack of historical backfill is accepted.
