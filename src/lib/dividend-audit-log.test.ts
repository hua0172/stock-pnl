import { describe, expect, test } from "vitest";
import { describeDividendAuditEntry } from "./dividend-audit-log";

describe("describeDividendAuditEntry", () => {
  test("a CREATE entry summarizes the new dividend", () => {
    const result = describeDividendAuditEntry({
      action: "CREATE",
      before: null,
      after: {
        paymentDate: "2026-03-01",
        market: "TW",
        symbol: "2330",
        amount: 1000,
        fxRate: 1,
      },
    });

    expect(result).toEqual({
      actionLabel: "新增",
      summary: "新增股息：2330（台股），2026-03-01 收到 1000",
    });
  });

  test("an UPDATE entry with a single changed field names that field's before/after", () => {
    const before = {
      paymentDate: "2026-03-01",
      market: "TW" as const,
      symbol: "2330",
      amount: 1000,
      fxRate: 1,
    };

    const result = describeDividendAuditEntry({
      action: "UPDATE",
      before,
      after: { ...before, amount: 1200 },
    });

    expect(result).toEqual({
      actionLabel: "編輯",
      summary: "金額：1000 → 1200",
    });
  });

  test("a DELETE entry summarizes the deleted dividend", () => {
    const result = describeDividendAuditEntry({
      action: "DELETE",
      before: {
        paymentDate: "2026-06-15",
        market: "US",
        symbol: "AAPL",
        amount: 25,
        fxRate: 32,
      },
      after: null,
    });

    expect(result).toEqual({
      actionLabel: "刪除",
      summary: "刪除股息：AAPL（美股），2026-06-15 收到 25",
    });
  });
});
