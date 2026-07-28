# Use Yahoo Finance's unofficial chart endpoint for both stock prices and USD/TWD FX rates

This system needs two live external data feeds: current stock prices (for unrealized P&L) and USD/TWD exchange rates, both historical (per trade date) and current. We settled on Yahoo Finance's unofficial `query1.finance.yahoo.com/v8/finance/chart/{symbol}` endpoint for both — stock prices via the ticker (`.TW` suffix for Taiwan), and FX via the `TWD=X` symbol, which returns daily history back to `range=max`, more than covering any realistic trade date. This consolidates the app onto a single external dependency instead of two.

## Considered options

- **Bank of Taiwan (rate.bot.com.tw)** — the natural first choice for a Taiwan-based user, but rejected after live verification: its historical query caps out at roughly 6 months of lookback, and the site sits behind an Akamai bot challenge that blocks plain server-side `fetch` calls entirely.
- **Frankfurter.app** — a free, keyless, ECB-sourced FX API with genuine arbitrary-date historical lookback. Rejected after checking its `/currencies` list: it only carries 31 major currencies, and TWD is not among them. ECB reference rates simply don't publish a TWD cross.
- **Yahoo Finance (chosen)** — unofficial and unversioned, so treat any given call as capable of failing (surfaced to the user rather than silently swallowed), but verified working for both the price and FX lookups this app needs, with no API key and adequate historical range.

## Consequences

Because this is a single unofficial endpoint for everything, if Yahoo changes or blocks it, both prices and FX break at once. `src/lib/yahoo.ts` is the one seam to replace if that happens — `fx.ts` and `price.ts` both depend on it and nothing else in the app talks to Yahoo directly.
