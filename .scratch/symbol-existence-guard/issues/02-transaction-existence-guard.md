# 02 — Transaction existence guard

**What to build:** `addTransaction` and `updateTransaction` both run the existence check for the entered market/symbol before saving. A `confirmedAbsent` result blocks the save with: `找不到股票代號「{symbol}」，請確認代號是否正確。` Any other result (exists, or undetermined due to a source not responding) allows the save to proceed as today.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Adding a transaction for a clearly nonexistent symbol is blocked with the specified error message, verified manually in the browser
- [ ] Editing a transaction to a clearly nonexistent symbol is blocked the same way
- [ ] Adding/editing a transaction for a real symbol still succeeds as before
- [ ] This guard runs alongside the existing oversell guard without interfering with it
