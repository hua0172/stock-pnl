# Stock P&L

A personal, local-only tracker for stock buy/sell transactions across the Taiwan and US markets, reporting profit and loss in a single TWD total.

## Language

**Transaction** (交易):
A single recorded buy or sell of a stock — market, symbol, trade date, quantity (in shares), price (in the market's original currency), and the TWD exchange rate resolved for that trade date.
_Avoid_: trade, record, entry

**Market** (市場):
Which of the two supported exchanges a transaction belongs to — `TW` (Taiwan) or `US`. Determines the transaction's original currency (TWD for `TW`, USD for `US`) and how its current price and symbol format are resolved.
_Avoid_: exchange, region

**Holding** (持股):
The current state of a single symbol derived from its transaction history — quantity currently held and its weighted-average cost. A holding can be fully closed (zero quantity) and still appear in the report for its historical realized P&L.
_Avoid_: position (used loosely elsewhere; here it always means this derived, per-symbol state)

**Weighted-Average Cost** (加權平均成本):
The cost-basis method used for this system: every buy folds its TWD-converted cost into a single running per-share average for that symbol; a sell consumes shares at that average, never at a specific batch's price. Chosen over FIFO to match the convention of Taiwanese brokerage apps.
_Avoid_: FIFO, cost basis (without qualifying which method)

**Total Cost** (總成本):
A Holding's cost basis for its currently-held quantity: Weighted-Average Cost per share × quantity held, in TWD (with the original-currency amount shown alongside for `US` Holdings, same as Weighted-Average Cost). Zero for a closed Holding (zero quantity held) — there is no remaining cost basis to report. Distinct from cumulative historical investment, which this does not track.
_Avoid_: cost basis (without qualifying "current holding" — always mean this specific holding-scoped figure), total investment (implies cumulative including sold shares, which this is not)

**Realized P&L** (已實現損益):
Profit or loss locked in by a `SELL` transaction: (sell price × sell trade-date FX rate − weighted-average cost per share at that moment) × quantity sold. Once realized, it does not change as later transactions happen — but a *correction* to the transaction that produced it (editing or deleting that same `SELL`) is not a later event, it's fixing the record of the one that already happened, so it does change the figure. See **Audit Log Entry** below for how a correction is distinguished from a new trade.
_Avoid_: booked P&L, closed P&L

**Unrealized P&L** (未實現損益):
Paper profit or loss on a holding's remaining quantity, marked to the symbol's current price and the current USD/TWD rate: (current price × current FX rate − weighted-average cost per share) × quantity held. Recomputed every time the report is viewed.
_Avoid_: paper P&L, open P&L

**Total P&L** (總損益):
A Holding's Realized P&L + Unrealized P&L + Dividend Income, added together. Realized and Unrealized P&L each keep their own precise, trading-only meaning — Dividend Income is a third, separate addend, never folded into either of them directly.
_Avoid_: net P&L (ambiguous about whether dividends are included — always mean this specific sum)

**FX Rate** (匯率):
The TWD value of one unit of a transaction's original currency. Stored per-transaction at its own trade date (`1.0` for `TW` transactions). Because each transaction carries its own historical rate, FX movement between trades is folded into Realized/Unrealized P&L rather than tracked as a separate figure — see [ADR-0004](./docs/adr/0004-cost-basis-tracked-in-twd.md).
_Avoid_: exchange rate, conversion rate

**Return Rate** (報酬率):
A holding's Realized P&L + Unrealized P&L expressed as a percentage of its cost: (Realized P&L + Unrealized P&L) ÷ (Weighted-Average Cost × quantity held) — deliberately excludes Dividend Income, reflecting price performance only. Dividend Income is already visible via Total P&L and the dedicated Dividend Income figure; this ratio isn't meant to double-count it. Undefined (`null`, not zero — and excluded from the Return Rate chart) for a closed Holding (zero quantity held) or an open Holding missing a current price or FX rate, since Realized/Unrealized P&L itself is incomplete without one. See [ADR-0008](./docs/adr/0008-return-rate-excludes-dividends.md) for why this reverses an earlier decision.
_Avoid_: yield, performance (too vague — always mean this specific ratio)

**Holding Allocation** (持股占比):
A Holding's current market value (quantity held × current price × current FX rate, in TWD) as a percentage of the total market value across all Holdings. Undefined (`null`, not zero) for a closed Holding or one missing live price data — such a Holding is excluded from the total entirely, not counted as contributing zero.
_Avoid_: weight, position size

**Audit Log Entry** (異動紀錄):
An immutable, append-only record of a single create, edit, or delete performed on a Transaction or a Dividend — captures which action it was and the record's full state before and after. Exists purely for the user's own review of what changed and when; never read by the P&L calculation, which always operates on the live Transaction and Dividend tables only. The action type is what distinguishes an original event (`CREATE` — a real trade or a real dividend payment) from a correction to one (`UPDATE`/`DELETE`, fixing the record of something that already happened, not a new one). Transactions and Dividends each keep their own separate audit log table and history page — the concept is shared, the tables are not.
_Avoid_: history, change log (too generic — always mean this specific append-only record)

**Dividend** (股息):
A single recorded cash payment received for holding a stock — market, symbol, payment date, and the after-tax amount actually deposited (no gross-up or withholding calculation). Converted to TWD using the historical FX rate at its own payment date, same as a Transaction. Contributes to a Holding's Dividend Income regardless of whether the Holding is still open or has since been fully closed. Exception: an auto-detected US-market Dividend (see auto dividend detection, `.scratch/auto-dividend-detection/spec.md`) records the pre-tax per-share amount as reported by the data source, with no brokerage-withholding deduction — an accepted simplification, since actual withholding varies per broker/account and isn't queryable from the same source. TW dividends aren't affected, since individual TW shareholders aren't withheld at source.
_Avoid_: distribution, payout (use Dividend consistently)
