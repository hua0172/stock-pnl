# 04 — Wire dividends into the report page

**What to build:** the report page fetches every `Dividend` record alongside transactions and passes them into the now-extended `calculatePnl`. A fourth overview card, "股息收入" (Dividend Income), appears alongside Realized P&L, Unrealized P&L, and Total P&L; the per-stock table gains a "股息" column showing each stock's `dividendTwd`. Total P&L and Return Rate visibly include dividend income once real data exists. Nav links to `/dividends` and `/dividends/history` are added alongside the existing transaction ones.

**Blocked by:** Ticket 01 (needs `calculatePnl`'s `dividendTwd` field), Ticket 02 (needs real `Dividend` data to query and display).

- [ ] Report page queries all `Dividend` records and passes them into `calculatePnl`
- [ ] A fourth overview card, "股息收入", shows `overview.dividendTwd`
- [ ] The per-stock table gains a "股息" column showing each stock's `dividendTwd`
- [ ] Total P&L and Return Rate visibly reflect recorded dividend income for a stock that has some
- [ ] A stock with no dividends shows `0`/no visual difference from before this ticket
- [ ] A closed holding's historical dividend income still shows in the "股息" column
- [ ] Nav links to `/dividends` and `/dividends/history` added to the report page header
- [ ] Manually verified in the browser: record a dividend for a held stock, confirm the overview card, per-stock column, and Return Rate all update correctly
- [ ] `tsc --noEmit`, `eslint`, and the full test suite pass
