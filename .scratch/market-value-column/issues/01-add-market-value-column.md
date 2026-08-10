# 01 — Add Market Value column to the report table

**What to build:** Extend `calculatePnl` so each `StockPnl` carries a new pair of display-only fields, `currentValueTwd` and `currentValueOriginal` (quantity held × current price, TWD and original-currency), then show them as a new "目前市值" column on the report page's per-stock table, between "目前股價" and "已實現". A fully closed holding (or a dividend-only symbol with no transaction history) shows Market Value as `0`. An open holding missing live price/FX data shows `null` (rendered as "—"). US-market rows show the original-currency (USD) amount alongside the TWD figure, matching the existing convention for "平均成本"/"總成本"/"已實現"/"未實現"/"總計". The existing `marketValueTwd`/`allocationPercent` fields (used by Holding Allocation and its pie chart) are untouched — this is purely additive.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `StockPnl` has new `currentValueTwd` and `currentValueOriginal` fields, computed in `calculatePnl`
- [ ] `currentValueTwd`: `currentPriceOriginal × currentFxRate × quantityHeld` when open and complete data; `0` when `quantityHeld === 0`; `null` when open but missing price/FX
- [ ] `currentValueOriginal`: `currentPriceOriginal × quantityHeld` (no FX dependency); `0` when `quantityHeld === 0`; `null` when open but missing price
- [ ] `pnl.test.ts` covers: an open TW holding, an open US holding (distinct TWD vs. original-currency figures), a fully closed holding (both fields `0`), the dividend-only-symbol edge case (both fields `0`), and an open holding with no resolvable price (both fields `null`)
- [ ] No existing `calculatePnl`/`pnl.test.ts` assertions change — `marketValueTwd` and `allocationPercent` behavior is unmodified
- [ ] Report page shows a "目前市值" column positioned between "目前股價" and "已實現"
- [ ] US-market rows show the TWD amount with the USD amount alongside in the same style as the "平均成本" cell; TW-market rows show only the TWD amount; `null` renders as "—" (same pattern as the "目前股價" cell)
- [ ] `CONTEXT.md` gains a **Market Value** (市值) glossary entry, positioned immediately before **Holding Allocation**, calling out the closed-holding discrepancy (`0` here vs. `null`/excluded in Holding Allocation's total)
- [ ] Verified manually in the browser against the live report page
