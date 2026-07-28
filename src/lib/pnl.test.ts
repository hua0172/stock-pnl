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

    expect(report.byStock).toEqual([
      {
        symbol: "2330",
        market: "TW",
        quantityHeld: 150,
        avgCostTwd: 550,
        currentPriceOriginal: 580,
        currentFxRate: 1,
        realizedPnlTwd: 7500,
        unrealizedPnlTwd: 4500,
        totalPnlTwd: 12000,
      },
    ]);
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
      },
    ]);
    expect(report.overview).toEqual({
      realizedPnlTwd: 3950,
      unrealizedPnlTwd: 0,
      totalPnlTwd: 3950,
    });
  });
});
