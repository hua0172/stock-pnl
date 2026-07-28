# 01 — Extract shared transaction input validation

**What to build:** `addTransaction`'s existing inline validation (trade-date format, market ∈ {TW,US}, side ∈ {BUY,SELL}, positive quantity, positive price) moves into a standalone, unit-tested `validateTransactionInput` function that `addTransaction` calls. `addTransaction`'s observable behavior — every error message, every accept/reject case — stays byte-for-byte identical; this is a pure refactor with no user-visible change, done first so the upcoming edit feature (Ticket 03) has one validation path to reuse instead of a second hand-kept copy.

**Blocked by:** None — can start immediately.

- [ ] `validateTransactionInput` exists as an importable, pure function returning either a validated value or an error message
- [ ] `addTransaction` calls it instead of its inline checks
- [ ] Unit tests cover: valid input, bad date format, invalid market, invalid side, non-positive quantity, non-positive price — matching the existing error message wording exactly
- [ ] Manually verified: the "Add transaction" form still behaves identically (same errors, same success path)
- [ ] `tsc --noEmit`, `eslint`, and the full test suite pass
