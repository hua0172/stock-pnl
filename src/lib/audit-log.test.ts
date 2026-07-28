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
});
