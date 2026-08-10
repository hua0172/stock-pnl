Status: ready-for-agent

# Market Value Column

## Problem Statement

The report page's per-stock table shows "目前股價"（current price per share）but never the total worth of a holding right now. `marketValueTwd` (quantity held × current price × current FX rate) is already computed in `src/lib/pnl.ts`, but it's only used internally to feed "持股占比" (Holding Allocation) — it's never shown to the user directly. To see how much a holding is currently worth, the user has to mentally multiply "持有股數" by "目前股價" themselves.

## Solution

Add a new **目前市值**（Market Value）column to the report page's per-stock table, positioned immediately to the right of "目前股價". It shows the current market value of the holding's currently-held quantity — quantity held × current price × current FX rate — in TWD, with the original-currency amount shown alongside for `US` holdings, matching the existing convention used by "平均成本"/"總成本"/"已實現"/"未實現"/"總計".

This is a **new, display-only pair of fields**, distinct from the existing `marketValueTwd` used internally for "持股占比". The two differ in how they treat a closed holding:

- The new display fields treat a closed holding (quantity held = 0) as worth **0** — consistent with how "總成本" already behaves for closed holdings.
- The existing `marketValueTwd` (feeding Holding Allocation) is untouched and keeps treating a closed holding as `null`, so it's excluded from the allocation total's denominator entirely, not folded in as zero.

Both fields still return `null` (shown as "—") when an *open* holding (quantity held > 0) is missing live price or FX data — that's a genuine data gap, not a "zero" answer.

## User Stories

1. As the user, I want to see each holding's current total market value (not just its per-share current price) in the report table, so that I don't have to manually multiply quantity by current price myself.
2. As the user, I want Market Value to reflect only the shares I currently hold (quantity held × current price × current FX rate), so that it matches what "目前股價" already means in this app.
3. As the user, I want a fully closed holding (quantity held = 0) to show a Market Value of 0, so that it's consistent with how "總成本" already behaves for closed holdings — there's nothing left to be worth.
4. As the user, I want an open holding with missing live price/FX data to show "—" rather than 0, so that a real data gap isn't mistaken for "this holding is worth nothing."
5. As the user, I want US-market holdings' Market Value to also show the original-currency (USD) amount alongside the TWD figure, consistent with how "平均成本"/"總成本" already do this.
6. As the user, I want the Market Value column positioned right next to "目前股價", so the table reads as a natural left-to-right pair: 目前股價 → 目前市值 (mirroring 平均成本 → 總成本).
7. As the user, I want this to be a pure display addition with no effect on Realized P&L, Unrealized P&L, Dividend Income, Total P&L, Return Rate, or the existing Holding Allocation calculation/pie chart — those are unchanged.

## Implementation Decisions

- **`calculatePnl` extended** (`src/lib/pnl.ts`): `StockPnl` gains two new fields, computed alongside the existing `marketValueTwd`/`allocationPercent` block but with their own closed-holding handling:
  - `currentValueTwd: number | null` — `currentPriceOriginal × currentFxRate × quantityHeld` when the holding is open (`quantityHeld > 0`) and both `currentPriceOriginal` and `currentFxRate` are non-null. `0` when `quantityHeld === 0` (closed, or the dividend-only-symbol edge case). `null` only when open but missing price/FX data.
  - `currentValueOriginal: number | null` — `currentPriceOriginal × quantityHeld`, the same figure in the holding's original currency. Does **not** depend on `currentFxRate` at all (mirrors how `avgCostOriginal`/`totalCostOriginal` never depend on current FX) — so it can be non-null even in the rare case where price is available but FX is not. `0` when `quantityHeld === 0`; `null` only when open but `currentPriceOriginal` itself is missing.
  - The existing `marketValueTwd` field, its `null`-for-closed-or-missing-data semantics, and `allocationPercent`'s computation are **not modified** — Holding Allocation keeps excluding closed/missing-data holdings from its total exactly as before.
- **Report page** (`src/app/page.tsx`): new "目前市值" table header and cell, positioned between the existing "目前股價" and "已實現" columns. The cell reuses the existing `formatTwd` + `originalRef` helpers: `US` rows show `{formatTwd(s.currentValueTwd)} ({formatOriginal(s.market, s.currentValueOriginal)})` when non-null, `TW` rows show just the TWD figure; either shows "—" when `null`.
  - `originalRef`/`formatOriginal` currently take a non-nullable `amount: number` — the new cell needs its own null-check before calling them (same pattern already used for `s.currentPriceOriginal !== null ? formatOriginal(...) : "—"` at the "目前股價" cell).
- **Domain glossary** (`CONTEXT.md`): new **Market Value** (市值) entry, positioned immediately before the existing **Holding Allocation** entry (which already references "current market value" inline — this promotes that phrase to a formal term). The entry calls out the closed-holding discrepancy with Holding Allocation's internal total explicitly, so a future reader isn't confused by the two different null/zero conventions.
- **No ADR** — like Total Cost, this is a small, easily-reversible addition with no real trade-off to record.
- **Out of scope for this round**: `report-charts.tsx` (the Holding Allocation pie chart) is untouched — it keeps using `marketValueTwd`/`allocationPercent` exactly as-is.

## Testing Decisions

- **`calculatePnl`** (existing seam, `src/lib/pnl.test.ts` extended): new assertions —
  - an open `TW` holding: `currentValueTwd` equals `currentPriceOriginal × currentFxRate × quantityHeld` (and `currentValueOriginal` equals the same value, since `TW` `fxRate` is `1.0`)
  - an open `US` holding: `currentValueTwd` equals `currentPriceOriginal × currentFxRate × quantityHeld`, and `currentValueOriginal` equals `currentPriceOriginal × quantityHeld` (a distinct USD figure)
  - a fully closed holding (all shares sold): both `currentValueTwd` and `currentValueOriginal` are `0`
  - the dividend-only-symbol edge case (no transactions, only dividend records): both fields are `0`
  - an open holding with no resolvable current price: both fields are `null`
  - existing assertions on `marketValueTwd`, `allocationPercent`, and other `StockPnl`/`PnlOverview` fields remain green, unmodified
- No new tests needed for `page.tsx` — it's a Server Component rendering already-computed, already-tested numbers through existing formatting helpers; verified manually in the browser, consistent with how the rest of the report table is handled.

## Out of Scope

- Any change to `report-charts.tsx`, the Holding Allocation pie chart, or the `marketValueTwd`/`allocationPercent` calculation — this feature is purely additive at the table level.
- Any notion of cumulative historical investment or lifetime realized value — Market Value is scoped to the current holding only.
- Any change to Realized P&L, Unrealized P&L, Dividend Income, Total P&L, or Return Rate.
- CSV import/export — Market Value is a derived reporting figure, not a recorded input.

## Further Notes

Same seam as Total Cost (`calculatePnl`) — no new seams introduced. The one subtlety worth flagging to whoever implements this: the new `currentValueTwd`/`currentValueOriginal` fields and the existing `marketValueTwd` field represent the *same underlying number* for an open holding with complete data, but diverge for a closed holding (0 vs. `null`) by deliberate choice — don't "simplify" by merging them back into one field, since Holding Allocation depends on the `null` behavior to exclude closed holdings from its denominator.
