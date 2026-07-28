Status: ready-for-agent

# Chinese UI + Return Rate / Holding Allocation Charts

## Problem Statement

The user only reads Chinese day-to-day and currently has to read the Stock P&L app's interface in English, adding friction every time they check it. The per-stock table also only shows raw TWD figures — there's no way to see at a glance which holdings are performing best in percentage terms, or how the portfolio is weighted across positions, without doing that math by hand from the table.

## Solution

Rewrite every piece of UI copy in the app — labels, buttons, form fields, validation messages, CSV import instructions — directly in Traditional Chinese, with no language switcher and no i18n library (see [ADR-0005](../../docs/adr/0005-hardcoded-chinese-ui-no-i18n.md)). Extend the existing `calculatePnl` pure function to also compute, per Holding, its Return Rate (報酬率) and its share of total portfolio market value (持股占比 / Holding Allocation), then render two new charts on the existing report page beneath the per-stock table: a bar chart of Return Rate by symbol, and a pie chart of Holding Allocation by symbol.

## User Stories

1. As the user, I want every label, button, and heading on the report page written in Traditional Chinese, so that I don't have to mentally translate the app every time I check it.
2. As the user, I want the "Add transaction" form's fields and validation error messages in Chinese, so that I understand exactly what went wrong when I mistype something.
3. As the user, I want the CSV import page's instructions and per-row error messages in Chinese, so that I can fix a bad row without cross-referencing English error text.
4. As the user, I want a bar chart showing each Holding's Return Rate (%), so that I can see at a glance which stocks are performing best or worst, relative to each other.
5. As the user, I want a fully-closed Holding (quantity held = 0) excluded from the Return Rate chart, so that undefined/meaningless percentages (dividing by a zero cost basis) never appear as misleading bars.
6. As the user, I want a pie chart showing each Holding's share of total portfolio market value, so that I can see how concentrated or diversified my holdings currently are.
7. As the user, I want a fully-closed Holding excluded from the allocation chart (rather than shown as a 0% slice), so that the chart isn't cluttered with positions I no longer hold.
8. As the user, I want both charts to appear on the existing report page, below the per-stock table, so that I see everything on one screen without extra navigation.
9. As the user, I want the Return Rate and Holding Allocation calculations to reuse the same weighted-average cost and current-price data already computed for the P&L table, so that the numbers in the charts and the table are always consistent with each other.
10. As the user, I want chart labels, legends, and tooltips also in Chinese, so that the whole page reads as one consistent language, not English charts bolted onto a Chinese page.
11. As the user, I want the app to keep working correctly (report loads, transactions can still be added/imported) after this change, so that localizing the text doesn't regress any existing functionality.
12. As the user, when live price or FX data fails to load (as already handled today via the existing data-error banner), I want the Return Rate/allocation charts to simply omit the affected Holding rather than crash or show garbage numbers, so that a partial data outage degrades gracefully like the rest of the report already does.

## Implementation Decisions

- **UI text**: every user-facing string in the report page, the "Add transaction" form, the CSV import page, and the Server Actions' validation/error messages is rewritten directly in Traditional Chinese. No i18n library, no language switch — this follows directly from ADR-0005, written during the grilling session preceding this spec.
- **`calculatePnl` extended, not replaced**: `StockPnl` gains three new fields, all derived from data the function already has:
  - `returnRatePercent: number | null` — Total P&L as a percentage of cost: `totalPnlTwd / (avgCostTwd × quantityHeld) × 100`. `null` when `quantityHeld` is 0 (a closed Holding has no cost basis to divide by).
  - `marketValueTwd: number | null` — current market value in TWD: `currentPriceOriginal × currentFxRate × quantityHeld`. `null` when `quantityHeld` is 0, or when either the current price or current FX rate is unavailable (mirrors the existing `null`-propagation pattern already used for `currentPriceOriginal`/`currentFxRate`).
  - `allocationPercent: number | null` — `marketValueTwd ÷ (sum of every non-null marketValueTwd across all Holdings) × 100`. `null` under the same conditions as `marketValueTwd`, or when the total market value is 0 (nothing to allocate against).
- **New dependency: a charting library.** Recharts is the pick — a React-native charting library with ready-made bar and pie chart components, no separate canvas/SVG plumbing required. Since Recharts needs the DOM, the two charts render inside a small Client Component that receives the already-computed `byStock` data as a prop from the (Server Component) report page — the data fetching and P&L calculation stay server-side, unchanged.
- **Placement**: both charts render in a new section on the report page, directly below the existing per-stock table, each filtering out any Holding where its respective field (`returnRatePercent` or `allocationPercent`) is `null`.
- Follow the `dataviz` skill's guidance (color choices, chart form, accessibility, light/dark handling) when building the charts, rather than re-deriving chart design conventions from scratch.
- **Domain glossary already updated**: `CONTEXT.md` gained **Return Rate** (報酬率) and **Holding Allocation** (持股占比) definitions, and `docs/adr/0005-hardcoded-chinese-ui-no-i18n.md` was written, during the grilling session that produced this spec — both already exist in the repo.

## Testing Decisions

- **No new test seam.** `returnRatePercent`, `marketValueTwd`, and `allocationPercent` are added to the existing, already-tested `calculatePnl` seam (`src/lib/pnl.test.ts`) as extended assertions on existing test cases plus a small number of new cases — not a new seam.
- New test cases to add to `pnl.test.ts`:
  - A Holding with `quantityHeld > 0` gets a non-`null` `returnRatePercent` matching `totalPnlTwd / cost × 100` against a known literal (not recomputed the same way the code does).
  - A fully-closed Holding (`quantityHeld = 0`) gets `returnRatePercent: null`, `marketValueTwd: null`, and `allocationPercent: null`.
  - Two Holdings with known current prices get `allocationPercent` values that sum to 100 (within floating-point tolerance) and are proportional to their respective market values.
  - A Holding whose current price is unavailable (mirroring the existing "data errors" pattern already handled on the report page) gets `marketValueTwd: null` and `allocationPercent: null`, and — critically — does **not** get counted as a zero in the denominator when computing the other Holdings' `allocationPercent` (excluded from the total, not silently treated as a zero-value entry within it).
- Chart rendering and the Chinese-language rewrite have no dedicated tests — verified manually in the browser via `claude-in-chrome`, consistent with how the rest of this app's UI (forms, CSV import) was verified during the original implementation.

## Out of Scope

- Any language other than Traditional Chinese, or a language switcher — explicitly rejected in the grilling session (see ADR-0005).
- Return Rate or Holding Allocation broken down by time period — still no year/date dimension on this report, consistent with the original spec's Out of Scope.
- Any new chart types beyond the two specified here (e.g. a historical P&L line chart over time) — not requested.
- Any change to the underlying P&L math (weighted-average cost, TWD conversion, fee/tax exclusion) — this spec only adds new derived, read-only fields to the existing calculation; nothing about Realized/Unrealized P&L itself changes.

## Further Notes

- This is the first change to introduce a chart-rendering dependency into the app — worth a quick sanity check that bundle size stays reasonable for what's meant to remain a small personal tool, though this isn't expected to be a real issue for two simple charts via Recharts.
- Because `calculatePnl` is a pure function with no I/O, adding these fields doesn't touch the CSV import or Server Action code paths at all — this is a low-risk, additive change scoped to one already well-tested module plus the report page's rendering.
