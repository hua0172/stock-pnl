# 06 — Dividend audit-log history shows symbol names

**What to build:** Mirrors ticket 04, for dividends: the dividend history page's change summaries show `名稱（代號）` wherever they currently mention a bare symbol.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `describeDividendAuditEntry` (`src/lib/dividend-audit-log.ts`) gains an optional `names: Partial<Record<string, string>>` parameter and uses it to format the symbol within its generated summary text
- [ ] Existing `dividend-audit-log.test.ts` cases still pass unchanged; new test cases cover summaries with a name supplied
- [ ] Dividend history page fetches names for every distinct symbol appearing across its audit entries and passes the map through
- [ ] Verified manually in the browser
