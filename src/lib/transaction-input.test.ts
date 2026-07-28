import { describe, expect, test } from "vitest";
import { validateTransactionInput } from "./transaction-input";

const VALID = {
  tradeDate: "2026-01-01",
  market: "TW",
  symbol: "2330",
  side: "BUY",
  quantity: "100",
  price: "500",
};

describe("validateTransactionInput", () => {
  test("valid input returns the parsed value", () => {
    const result = validateTransactionInput(VALID);

    expect(result).toEqual({
      value: {
        tradeDate: "2026-01-01",
        market: "TW",
        symbol: "2330",
        side: "BUY",
        quantity: 100,
        price: 500,
      },
    });
  });

  test("a malformed trade date is rejected", () => {
    const result = validateTransactionInput({ ...VALID, tradeDate: "01/01/2026" });

    expect(result).toEqual({ error: "交易日期格式必須是 YYYY-MM-DD。" });
  });

  test("an invalid market is rejected", () => {
    const result = validateTransactionInput({ ...VALID, market: "JP" });

    expect(result).toEqual({ error: "市場欄位必須是 TW 或 US。" });
  });

  test("a missing symbol is rejected", () => {
    const result = validateTransactionInput({ ...VALID, symbol: "  " });

    expect(result).toEqual({ error: "請輸入股票代號。" });
  });

  test("an invalid side is rejected", () => {
    const result = validateTransactionInput({ ...VALID, side: "HOLD" });

    expect(result).toEqual({ error: "買賣別必須是 BUY 或 SELL。" });
  });

  test("a non-positive quantity is rejected", () => {
    const result = validateTransactionInput({ ...VALID, quantity: "0" });

    expect(result).toEqual({ error: "股數必須是正數。" });
  });

  test("a non-positive price is rejected", () => {
    const result = validateTransactionInput({ ...VALID, price: "-10" });

    expect(result).toEqual({ error: "價格必須是正數。" });
  });
});
