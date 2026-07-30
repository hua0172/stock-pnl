# 04 — Oversell guard on deleting a transaction

**What to build:** `deleteTransaction` fetches the symbol's existing transactions excluding the one being deleted, and validates the remaining sequence. A violation blocks the delete with an error naming the later transaction that would become invalid: `無法刪除：刪除後，{tradeDate} 的賣出交易將變成超賣（當下僅剩 {availableQuantity} 股，但那筆賣出了 {attemptedQuantity} 股）`.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Deleting a `BUY` that a later `SELL` depends on is blocked with the specified error message, verified manually in the browser
- [ ] Deleting a transaction that doesn't invalidate anything still succeeds as before
