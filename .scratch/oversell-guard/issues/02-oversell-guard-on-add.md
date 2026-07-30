# 02 — Oversell guard on adding a transaction

**What to build:** `addTransaction` fetches the symbol's existing transactions, appends the one being added, and runs `findOversellViolation`. A violation blocks the save and returns a form error: `股數不足：{tradeDate} 當下持有 {availableQuantity} 股，無法賣出 {attemptedQuantity} 股` — shown the same way the existing FX-rate-error is shown.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Adding a `SELL` transaction that would exceed the symbol's holdings at that trade date is blocked with the specified error message, verified manually in the browser
- [ ] Adding a valid transaction (no violation) still succeeds as before
