# 02 — Return Rate bar chart + Holding Allocation pie chart on the report page

**What to build:** the user opens the report page and, below the existing per-stock table, sees two new charts rendered from the fields added in Ticket 01:

- A **bar chart** of Return Rate (報酬率) by symbol, one bar per Holding, excluding any Holding whose `returnRatePercent` is `null` (fully-closed Holdings).
- A **pie chart** of Holding Allocation (持股占比) by symbol, excluding any Holding whose `allocationPercent` is `null` (fully-closed Holdings, or Holdings missing live price data).

Both charts use Recharts (new dependency), rendered inside a small Client Component that receives the already-computed per-stock data as a prop — data fetching and P&L calculation stay in the existing Server Component. Chart labels, legend, and tooltips are in Traditional Chinese from the start (this ticket doesn't depend on Ticket 03's app-wide text rewrite — it's new UI, not a translation of existing English text). Follow the `dataviz` skill's guidance for chart form, color, and light/dark handling.

If live price or FX data fails to load for a Holding (the report page's existing data-error banner already surfaces this), that Holding is simply omitted from both charts rather than shown with a garbage or zero value.

**Blocked by:** Ticket 01 (needs `returnRatePercent`, `marketValueTwd`, `allocationPercent` on `StockPnl`).

- [ ] Recharts added as a dependency
- [ ] Bar chart of Return Rate renders below the per-stock table, one bar per Holding with non-null `returnRatePercent`
- [ ] Pie chart of Holding Allocation renders below the bar chart, one slice per Holding with non-null `allocationPercent`
- [ ] Fully-closed Holdings do not appear in either chart
- [ ] A Holding missing live price data does not appear in the allocation chart and doesn't skew the other slices
- [ ] Chart labels/legend/tooltips are in Traditional Chinese
- [ ] Charts render correctly in both light and dark mode (per the `dataviz` skill)
- [ ] Verified manually in the browser with at least one TW and one US holding present
- [ ] `tsc --noEmit`, `eslint`, and the full test suite still pass
