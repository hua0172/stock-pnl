import { describe, expect, test } from "vitest";
import { calculatePnl } from "./pnl";

describe("calculatePnl", () => {
  test("a single buy with no sell is entirely unrealized P&L", () => {
    const report = calculatePnl(
      [
        {
          tradeDate: "2026-01-01",
          market: "TW",
          symbol: "2330",
          side: "BUY",
          quantity: 100,
          price: 500,
          fxRate: 1,
        },
      ],
      { "2330": 600 },
      { TW: 1, US: 1 },
    );

    expect(report.byStock).toEqual([
      {
        symbol: "2330",
        market: "TW",
        quantityHeld: 100,
        avgCostTwd: 500,
        currentPriceOriginal: 600,
        currentFxRate: 1,
        realizedPnlTwd: 0,
        unrealizedPnlTwd: 10000,
        totalPnlTwd: 10000,
        avgCostOriginal: 500,
        realizedPnlOriginal: 0,
        unrealizedPnlOriginal: 10000,
        marketValueTwd: 60000,
        returnRatePercent: 20,
        allocationPercent: 100,
      },
    ]);
    expect(report.overview).toEqual({
      realizedPnlTwd: 0,
      unrealizedPnlTwd: 10000,
      totalPnlTwd: 10000,
    });
  });

  test("a buy fully closed out by a sell is entirely realized P&L, with the closed position still reported", () => {
    const report = calculatePnl(
      [
        {
          tradeDate: "2026-01-01",
          market: "TW",
          symbol: "2330",
          side: "BUY",
          quantity: 100,
          price: 500,
          fxRate: 1,
        },
        {
          tradeDate: "2026-02-01",
          market: "TW",
          symbol: "2330",
          side: "SELL",
          quantity: 100,
          price: 550,
          fxRate: 1,
        },
      ],
      { "2330": 600 },
      { TW: 1, US: 1 },
    );

    expect(report.byStock).toEqual([
      {
        symbol: "2330",
        market: "TW",
        quantityHeld: 0,
        avgCostTwd: 0,
        currentPriceOriginal: 600,
        currentFxRate: 1,
        realizedPnlTwd: 5000,
        unrealizedPnlTwd: 0,
        totalPnlTwd: 5000,
        avgCostOriginal: 0,
        realizedPnlOriginal: 5000,
        unrealizedPnlOriginal: 0,
        marketValueTwd: null,
        returnRatePercent: null,
        allocationPercent: null,
      },
    ]);
    expect(report.overview).toEqual({
      realizedPnlTwd: 5000,
      unrealizedPnlTwd: 0,
      totalPnlTwd: 5000,
    });
  });

  test("a partial sell after buys at different prices uses the weighted-average cost", () => {
    const report = calculatePnl(
      [
        {
          tradeDate: "2026-01-01",
          market: "TW",
          symbol: "2330",
          side: "BUY",
          quantity: 100,
          price: 500,
          fxRate: 1,
        },
        {
          tradeDate: "2026-01-15",
          market: "TW",
          symbol: "2330",
          side: "BUY",
          quantity: 100,
          price: 600,
          fxRate: 1,
        },
        {
          tradeDate: "2026-02-01",
          market: "TW",
          symbol: "2330",
          side: "SELL",
          quantity: 50,
          price: 700,
          fxRate: 1,
        },
      ],
      { "2330": 580 },
      { TW: 1, US: 1 },
    );

    expect(report.byStock).toHaveLength(1);
    // returnRatePercent is 12000/82500*100, a repeating decimal — checked
    // separately below rather than folded into the exact-equality check.
    expect(report.byStock[0]).toMatchObject({
      symbol: "2330",
      market: "TW",
      quantityHeld: 150,
      avgCostTwd: 550,
      currentPriceOriginal: 580,
      currentFxRate: 1,
      realizedPnlTwd: 7500,
      unrealizedPnlTwd: 4500,
      totalPnlTwd: 12000,
      avgCostOriginal: 550,
      realizedPnlOriginal: 7500,
      unrealizedPnlOriginal: 4500,
      marketValueTwd: 87000,
      allocationPercent: 100,
    });
    expect(report.byStock[0].returnRatePercent).toBeCloseTo(
      14.545454545454545,
      9,
    );
    expect(report.overview).toEqual({
      realizedPnlTwd: 7500,
      unrealizedPnlTwd: 4500,
      totalPnlTwd: 12000,
    });
  });

  test("FX rate movement between a US-market buy and sell flows into realized P&L", () => {
    const report = calculatePnl(
      [
        {
          tradeDate: "2026-01-01",
          market: "US",
          symbol: "AAPL",
          side: "BUY",
          quantity: 10,
          price: 150,
          fxRate: 31.5,
        },
        {
          tradeDate: "2026-02-01",
          market: "US",
          symbol: "AAPL",
          side: "SELL",
          quantity: 10,
          price: 160,
          fxRate: 32,
        },
      ],
      { AAPL: 165 },
      { TW: 1, US: 32.5 },
    );

    // Stock gain alone would be (160-150)*10 = $100. Priced in TWD at each
    // trade's own rate: proceeds 10*160*32 = 51200, cost 10*150*31.5 = 47250,
    // realized = 3950 — more than the $100 stock move converted at either
    // single rate, because the FX rate itself moved between the two trades.
    // The *Original fields are the pure-USD reference figures (no FX at all),
    // so they correctly show the plain $100 stock gain rather than 3950.
    expect(report.byStock).toEqual([
      {
        symbol: "AAPL",
        market: "US",
        quantityHeld: 0,
        avgCostTwd: 0,
        currentPriceOriginal: 165,
        currentFxRate: 32.5,
        realizedPnlTwd: 3950,
        unrealizedPnlTwd: 0,
        totalPnlTwd: 3950,
        avgCostOriginal: 0,
        realizedPnlOriginal: 100,
        unrealizedPnlOriginal: 0,
        marketValueTwd: null,
        returnRatePercent: null,
        allocationPercent: null,
      },
    ]);
    expect(report.overview).toEqual({
      realizedPnlTwd: 3950,
      unrealizedPnlTwd: 0,
      totalPnlTwd: 3950,
    });
  });

  test("allocationPercent is proportional to market value and sums to 100 across holdings", () => {
    const report = calculatePnl(
      [
        {
          tradeDate: "2026-01-01",
          market: "TW",
          symbol: "2330",
          side: "BUY",
          quantity: 100,
          price: 500,
          fxRate: 1,
        },
        {
          tradeDate: "2026-01-01",
          market: "TW",
          symbol: "2454",
          side: "BUY",
          quantity: 50,
          price: 1000,
          fxRate: 1,
        },
      ],
      { "2330": 600, "2454": 1100 },
      { TW: 1, US: 1 },
    );

    // Market values: 2330 = 600*100 = 60000, 2454 = 1100*50 = 55000, total 115000.
    const bySymbol = Object.fromEntries(report.byStock.map((s) => [s.symbol, s]));
    expect(bySymbol["2330"].marketValueTwd).toBe(60000);
    expect(bySymbol["2454"].marketValueTwd).toBe(55000);
    expect(bySymbol["2330"].allocationPercent).toBeCloseTo(52.17391304, 6);
    expect(bySymbol["2454"].allocationPercent).toBeCloseTo(47.82608696, 6);
    expect(
      bySymbol["2330"].allocationPercent! + bySymbol["2454"].allocationPercent!,
    ).toBeCloseTo(100, 9);
  });

  test("a holding missing live price data is excluded from allocation entirely, not counted as a zero", () => {
    const report = calculatePnl(
      [
        {
          tradeDate: "2026-01-01",
          market: "TW",
          symbol: "2330",
          side: "BUY",
          quantity: 100,
          price: 500,
          fxRate: 1,
        },
        {
          tradeDate: "2026-01-01",
          market: "TW",
          symbol: "2454",
          side: "BUY",
          quantity: 50,
          price: 1000,
          fxRate: 1,
        },
      ],
      { "2330": 600 }, // 2454's live price could not be fetched
      { TW: 1, US: 1 },
    );

    const bySymbol = Object.fromEntries(report.byStock.map((s) => [s.symbol, s]));
    expect(bySymbol["2454"].marketValueTwd).toBeNull();
    expect(bySymbol["2454"].allocationPercent).toBeNull();
    // 2454 is excluded from the denominator entirely, so 2330 — the only
    // holding with a known market value — gets the full 100%, not ~52%.
    expect(bySymbol["2330"].allocationPercent).toBe(100);
  });
});
