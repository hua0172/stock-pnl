# 03 — Dividend existence guard

**What to build:** Mirrors ticket 02 for dividends: `addDividend` and `updateDividend` both run the existence check before saving, blocking with the same error message format on a `confirmedAbsent` result.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Adding a dividend for a clearly nonexistent symbol is blocked with the specified error message, verified manually in the browser
- [ ] Editing a dividend to a clearly nonexistent symbol is blocked the same way
- [ ] Adding/editing a dividend for a real symbol still succeeds as before
