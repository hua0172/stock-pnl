# 04 — Transaction audit-log history shows symbol names

**What to build:** The transaction history page's change summaries show `名稱（代號）` wherever they currently mention a bare symbol.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `describeAuditEntry` (`src/lib/audit-log.ts`) gains an optional `names: Partial<Record<string, string>>` parameter and uses it to format the symbol within its generated summary text
- [ ] Existing `audit-log.test.ts` cases still pass unchanged (calling without the new parameter preserves today's exact output); new test cases cover summaries with a name supplied
- [ ] Transaction history page fetches names for every distinct symbol appearing across its audit entries and passes the map through
- [ ] Verified manually in the browser: a history entry for a symbol with a known name shows it correctly formatted within the summary text
