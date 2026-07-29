Status: ready-for-agent

# Total Cost Column

## Problem Statement

The report page's per-stock table shows Weighted-Average Cost (average cost per share) but never the total amount of capital tied up in a holding right now. To see how much TWD (or original-currency) capital a given holding currently represents, the user has to mentally multiply "持有股數" by "平均成本" themselves every time.

## Solution

Add a new **Total Cost**（總成本）column to the report page's per-stock table, positioned immediately to the right of "平均成本（台幣）" and to the left of "目前股價". It shows the cost basis of the holding's currently-held quantity — Weighted-Average Cost per share × quantity held — in TWD, with the original-currency amount shown alongside for `US` holdings, matching the existing convention used by the "平均成本"/"已實現"/"未實現"/"總計" columns.

## User Stories

1. As the user, I want to see each holding's total cost (not just its per-share average cost) in the report table, so that I don't have to manually multiply quantity by average cost myself.
2. As the user, I want Total Cost to reflect only the shares I currently hold (quantity held × average cost), so that it matches what "平均成本" already means in this app, not some other notion of cumulative lifetime investment.
3. As the user, I want a fully closed holding (quantity held = 0) to show a Total Cost of zero, so that it's consistent with how "平均成本" already behaves for closed holdings — there's no remaining cost basis to report.
4. As the user, I want US-market holdings' Total Cost to also show the original-currency (USD) amount alongside the TWD figure, so that I can verify the number against my own USD-denominated cost records, consistent with how "平均成本" already does this.
5. As the user, I want the Total Cost column positioned right next to "平均成本", so that the table reads as a natural left-to-right calculation: 持有股數 → 平均成本 → 總成本.
6. As the user, I want this to be purely a new reporting figure with no effect on Realized P&L, Unrealized P&L, Dividend Income, Total P&L, or Return Rate — those are unchanged by this feature.

## Implementation Decisions

- **`calculatePnl` extended** (`src/lib/pnl.ts`): `StockPnl` gains two new fields:
  - `totalCostTwd: number` — `avgCostTwd × quantityHeld`. `0` for a closed holding (`quantityHeld` is `0`), matching how `avgCostTwd` itself already defaults to `0` in that case. Always a number, never `null` — unlike `marketValueTwd`/`returnRatePercent`/`allocationPercent`, this doesn't depend on live market data.
  - `totalCostOriginal: number` — `avgCostOriginal × quantityHeld`, the same figure in the holding's original currency (equal to the TWD figure for `TW` holdings, a separate USD figure for `US` holdings).
  - Both are computed the same way for the existing dividend-only-symbol edge case (a symbol with dividend records but no transaction history) — `quantityHeld` is `0` there too, so both new fields are `0`.
  - No change to `PnlOverview`, `totalPnlTwd`, or `returnRatePercent` — this feature adds a new pair of fields only, it does not touch existing P&L math.
- **Report page** (`src/app/page.tsx`): new "總成本" table header and cell, positioned between the existing "平均成本（台幣）" and "目前股價" columns. The cell reuses the existing `formatTwd` + `originalRef` helpers already used by the "平均成本" cell, so `US` rows show `{formatTwd(s.totalCostTwd)} ({formatOriginal(s.market, s.totalCostOriginal)})` and `TW` rows show just the TWD figure.
- **Domain glossary**: `CONTEXT.md` already has a **Total Cost** (總成本) entry (added during grilling, immediately after **Weighted-Average Cost**) — no further glossary changes needed.
- **No ADR** — this is a small, easily-reversible addition with no real trade-off to record.

## Testing Decisions

- **`calculatePnl`** (existing seam, `src/lib/pnl.test.ts` extended): new assertions —
  - an open `TW` holding: `totalCostTwd` equals `avgCostTwd × quantityHeld` (and `totalCostOriginal` equals the same value, since `TW` fxRate is `1.0`)
  - an open `US` holding: `totalCostTwd` equals `avgCostTwd × quantityHeld`, and `totalCostOriginal` equals `avgCostOriginal × quantityHeld` (a distinct USD figure)
  - a fully closed holding (all shares sold): both `totalCostTwd` and `totalCostOriginal` are `0`
  - the dividend-only-symbol edge case (no transactions, only dividend records): both fields are `0`
  - existing assertions on other `StockPnl` fields and `PnlOverview` remain green, unmodified — this is a pure addition
- No new tests needed for `page.tsx` — it's a Server Component rendering already-computed, already-tested numbers through existing formatting helpers; verified manually in the browser, consistent with how the rest of the report table is handled.

## Out of Scope

- Any notion of cumulative historical investment (including cost of shares already sold) — Total Cost is scoped to the current holding only, per this round's decision.
- Any change to Realized P&L, Unrealized P&L, Dividend Income, Total P&L, or Return Rate — this feature is additive and does not touch existing P&L math.
- Any chart or visualization of Total Cost — table column only.
- CSV import/export — Total Cost is a derived reporting figure, not a recorded input.

## Further Notes

This is a small, self-contained addition at the same seam (`calculatePnl`) already used for every other derived reporting figure in this app (`marketValueTwd`, `returnRatePercent`, `allocationPercent`) — no new seams are introduced.
