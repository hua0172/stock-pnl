# Stock P&L

A personal, local-only tracker for stock buy/sell transactions across the Taiwan and US markets, reporting profit and loss in a single TWD total.

## Language

**Transaction**:
A single recorded buy or sell of a stock — market, symbol, trade date, quantity (in shares), price (in the market's original currency), and the TWD exchange rate resolved for that trade date.
_Avoid_: trade, record, entry

**Market**:
Which of the two supported exchanges a transaction belongs to — `TW` (Taiwan) or `US`. Determines the transaction's original currency (TWD for `TW`, USD for `US`) and how its current price and symbol format are resolved.
_Avoid_: exchange, region

**Holding**:
The current state of a single symbol derived from its transaction history — quantity currently held and its weighted-average cost. A holding can be fully closed (zero quantity) and still appear in the report for its historical realized P&L.
_Avoid_: position (used loosely elsewhere; here it always means this derived, per-symbol state)

**Weighted-Average Cost**:
The cost-basis method used for this system: every buy folds its TWD-converted cost into a single running per-share average for that symbol; a sell consumes shares at that average, never at a specific batch's price. Chosen over FIFO to match the convention of Taiwanese brokerage apps.
_Avoid_: FIFO, cost basis (without qualifying which method)

**Realized P&L**:
Profit or loss locked in by a `SELL` transaction: (sell price × sell trade-date FX rate − weighted-average cost per share at that moment) × quantity sold. Once realized, it does not change as later transactions happen.
_Avoid_: booked P&L, closed P&L

**Unrealized P&L**:
Paper profit or loss on a holding's remaining quantity, marked to the symbol's current price and the current USD/TWD rate: (current price × current FX rate − weighted-average cost per share) × quantity held. Recomputed every time the report is viewed.
_Avoid_: paper P&L, open P&L

**FX Rate**:
The TWD value of one unit of a transaction's original currency. Stored per-transaction at its own trade date (`1.0` for `TW` transactions). Because each transaction carries its own historical rate, FX movement between trades is folded into Realized/Unrealized P&L rather than tracked as a separate figure — see [ADR-0004](./docs/adr/0004-cost-basis-tracked-in-twd.md).
_Avoid_: exchange rate, conversion rate

**Return Rate** (報酬率):
A holding's Total P&L expressed as a percentage of its cost: Total P&L ÷ (Weighted-Average Cost × quantity held). Undefined (and excluded from the Return Rate chart) for a closed Holding, since its quantity held is zero.
_Avoid_: yield, performance (too vague — always mean this specific ratio)

**Holding Allocation** (持股占比):
A Holding's current market value (quantity held × current price × current FX rate, in TWD) as a percentage of the total market value across all Holdings. A closed Holding has zero market value and so zero allocation.
_Avoid_: weight, position size
