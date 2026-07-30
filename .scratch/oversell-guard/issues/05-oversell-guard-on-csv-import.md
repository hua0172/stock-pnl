# 05 — Oversell guard on CSV import

**What to build:** `importTransactionsCsv` validates each row, in file order, against that symbol's existing DB transactions plus whichever earlier rows in the same import already succeeded for that symbol. A violation skips that row and appends an error in the existing per-row format: `匯入失敗（{symbol}，{tradeDate}）：股數不足，當下持有 {availableQuantity} 股，無法賣出 {attemptedQuantity} 股`. Rows that pass continue to be inserted immediately, matching current behavior.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] A CSV row that would cause an oversell (against existing data or an earlier row in the same file) is skipped and reported as an error, verified manually via the import page
- [ ] Other valid rows in the same file still import successfully even when one row is skipped
- [ ] A CSV import with no violations behaves exactly as it does today
