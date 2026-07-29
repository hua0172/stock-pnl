# 01 — Add Total Cost column to the report table

**What to build:** Extend `calculatePnl` so each `StockPnl` carries its Total Cost (Weighted-Average Cost per share × quantity held) in both TWD and the holding's original currency, then show it as a new "總成本" column on the report page's per-stock table, between "平均成本（台幣）" and "目前股價". A fully closed holding (or a dividend-only symbol with no transaction history) shows Total Cost as zero, consistent with how "平均成本" already behaves. US-market rows show the original-currency (USD) amount alongside the TWD figure, matching the existing convention for "平均成本"/"已實現"/"未實現"/"總計".

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `StockPnl` has new `totalCostTwd` and `totalCostOriginal` fields, computed in `calculatePnl`
- [ ] `pnl.test.ts` covers: an open TW holding, an open US holding (distinct TWD vs. original-currency figures), a fully closed holding (both fields `0`), and the dividend-only-symbol edge case (both fields `0`)
- [ ] No existing `calculatePnl`/`pnl.test.ts` assertions change — this is a pure addition
- [ ] Report page shows a "總成本" column positioned between "平均成本（台幣）" and "目前股價"
- [ ] US-market rows show the TWD amount with the USD amount alongside in the same style as the "平均成本" cell; TW-market rows show only the TWD amount
- [ ] Verified manually in the browser against the live report page
