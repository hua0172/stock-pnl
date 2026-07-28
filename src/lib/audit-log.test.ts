import { describe, expect, test } from "vitest";
import { describeAuditEntry } from "./audit-log";

describe("describeAuditEntry", () => {
  test("a CREATE entry summarizes the new transaction", () => {
    const result = describeAuditEntry({
      action: "CREATE",
      before: null,
      after: {
        tradeDate: "2026-01-01",
        market: "TW",
        symbol: "2330",
        side: "BUY",
        quantity: 100,
        price: 500,
        fxRate: 1,
      },
    });

    expect(result).toEqual({
      actionLabel: "新增",
      summary: "新增交易：2330（台股），買進 100 股 @500",
    });
  });

  test("an UPDATE entry with a single changed field names that field's before/after", () => {
    const before = {
      tradeDate: "2026-01-01",
      market: "TW" as const,
      symbol: "2330",
      side: "BUY" as const,
      quantity: 100,
      price: 500,
      fxRate: 1,
    };

    const result = describeAuditEntry({
      action: "UPDATE",
      before,
      after: { ...before, price: 550 },
    });

    expect(result).toEqual({
      actionLabel: "編輯",
      summary: "價格：500 → 550",
    });
  });

  test("an UPDATE entry with multiple changed fields lists all of them", () => {
    const before = {
      tradeDate: "2026-01-01",
      market: "TW" as const,
      symbol: "2330",
      side: "BUY" as const,
      quantity: 100,
      price: 500,
      fxRate: 1,
    };

    const result = describeAuditEntry({
      action: "UPDATE",
      before,
      after: { ...before, quantity: 120, price: 550 },
    });

    expect(result).toEqual({
      actionLabel: "編輯",
      summary: "股數：100 → 120、價格：500 → 550",
    });
  });

  test("a fxRate change with floating-point noise is rounded for readability", () => {
    const before = {
      tradeDate: "2026-01-05",
      market: "US" as const,
      symbol: "AAPL",
      side: "BUY" as const,
      quantity: 10,
      price: 150,
      fxRate: 31.58300018310547,
    };

    const result = describeAuditEntry({
      action: "UPDATE",
      before,
      after: { ...before, tradeDate: "2025-06-02", fxRate: 29.094999313354492 },
    });

    expect(result).toEqual({
      actionLabel: "編輯",
      summary: "交易日期：2026-01-05 → 2025-06-02、匯率：31.583 → 29.095",
    });
  });

  test("a DELETE entry summarizes the deleted transaction", () => {
    const result = describeAuditEntry({
      action: "DELETE",
      before: {
        tradeDate: "2026-02-01",
        market: "US",
        symbol: "AAPL",
        side: "SELL",
        quantity: 10,
        price: 160,
        fxRate: 32,
      },
      after: null,
    });

    expect(result).toEqual({
      actionLabel: "刪除",
      summary: "刪除交易：AAPL（美股），賣出 10 股 @160",
    });
  });
});
