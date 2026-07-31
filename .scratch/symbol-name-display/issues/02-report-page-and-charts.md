# 02 — Report page + charts show symbol names

**What to build:** The main report page's per-stock table, the Return Rate bar chart, and the Holding Allocation pie chart all display `名稱（代號）` instead of the bare symbol.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Report page fetches names for every distinct symbol/market pair already being fetched for live prices, and renders each row's symbol cell via `formatSymbolLabel`
- [ ] A symbol with no matched name still renders correctly (falls back to the bare symbol), verified manually
- [ ] Return Rate bar chart's category (X-axis) labels show `名稱（代號）`
- [ ] Holding Allocation pie chart's slice labels and legend show `名稱（代號）`
- [ ] Verified manually in the browser against real data: at least one TW holding shows its Chinese name, at least one US holding shows its English name
