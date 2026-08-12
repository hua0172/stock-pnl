import { describe, expect, test } from "vitest";
import { validateDividendInput } from "./dividend-input";

const VALID = {
  paymentDate: "2026-03-01",
  market: "TW",
  symbol: "2330",
  amount: "1000",
};

describe("validateDividendInput", () => {
  test("valid input returns the parsed value", () => {
    const result = validateDividendInput(VALID);

    expect(result).toEqual({
      value: {
        paymentDate: "2026-03-01",
        market: "TW",
        symbol: "2330",
        amount: 1000,
      },
    });
  });

  test("a mixed-case symbol is normalized to uppercase", () => {
    const result = validateDividendInput({ ...VALID, symbol: "Voo" });

    expect(result).toEqual({
      value: {
        paymentDate: "2026-03-01",
        market: "TW",
        symbol: "VOO",
        amount: 1000,
      },
    });
  });

  test("a malformed payment date is rejected", () => {
    const result = validateDividendInput({ ...VALID, paymentDate: "03/01/2026" });

    expect(result).toEqual({ error: "發放日期格式必須是 YYYY-MM-DD。" });
  });

  test("an invalid market is rejected", () => {
    const result = validateDividendInput({ ...VALID, market: "JP" });

    expect(result).toEqual({ error: "市場欄位必須是 TW 或 US。" });
  });

  test("a missing symbol is rejected", () => {
    const result = validateDividendInput({ ...VALID, symbol: "  " });

    expect(result).toEqual({ error: "請輸入股票代號。" });
  });

  test("a non-positive amount is rejected", () => {
    const result = validateDividendInput({ ...VALID, amount: "0" });

    expect(result).toEqual({ error: "股息金額必須是正數。" });
  });
});
