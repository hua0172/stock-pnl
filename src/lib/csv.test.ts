import { describe, expect, test } from "vitest";
import { parseTransactionsCsv } from "./csv";

describe("parseTransactionsCsv", () => {
  test("a fully valid file parses every row with no errors", () => {
    const csv = [
      "trade_date,market,symbol,side,quantity,price",
      "2026-01-01,TW,2330,BUY,100,500",
      "2026-02-01,US,AAPL,SELL,10,160",
    ].join("\n");

    const result = parseTransactionsCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.transactions).toEqual([
      {
        tradeDate: "2026-01-01",
        market: "TW",
        symbol: "2330",
        side: "BUY",
        quantity: 100,
        price: 500,
      },
      {
        tradeDate: "2026-02-01",
        market: "US",
        symbol: "AAPL",
        side: "SELL",
        quantity: 10,
        price: 160,
      },
    ]);
  });

  test("a mixed-case symbol is normalized to uppercase", () => {
    const csv = [
      "trade_date,market,symbol,side,quantity,price",
      "2026-01-01,US,Voo,BUY,10,600",
    ].join("\n");

    const result = parseTransactionsCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.transactions).toEqual([
      {
        tradeDate: "2026-01-01",
        market: "US",
        symbol: "VOO",
        side: "BUY",
        quantity: 10,
        price: 600,
      },
    ]);
  });

  test("a missing required column fails the whole file with one clear error", () => {
    const csv = [
      "trade_date,market,symbol,side,quantity",
      "2026-01-01,TW,2330,BUY,100",
    ].join("\n");

    const result = parseTransactionsCsv(csv);

    expect(result.transactions).toEqual([]);
    expect(result.errors).toEqual([{ row: 0, message: "缺少必要欄位：price" }]);
  });

  test("an invalid market or side value is reported as a row-level error", () => {
    const csv = [
      "trade_date,market,symbol,side,quantity,price",
      "2026-01-01,JP,2330,BUY,100,500",
      "2026-01-02,TW,2330,HOLD,100,500",
    ].join("\n");

    const result = parseTransactionsCsv(csv);

    expect(result.transactions).toEqual([]);
    expect(result.errors).toEqual([
      { row: 1, message: "市場欄位錯誤：「JP」" },
      { row: 2, message: "買賣別錯誤：「HOLD」" },
    ]);
  });

  test("a malformed date or non-numeric quantity/price is reported as a row-level error", () => {
    const csv = [
      "trade_date,market,symbol,side,quantity,price",
      "01/01/2026,TW,2330,BUY,100,500",
      "2026-01-02,TW,2330,BUY,abc,500",
      "2026-01-03,TW,2330,BUY,100,xyz",
    ].join("\n");

    const result = parseTransactionsCsv(csv);

    expect(result.transactions).toEqual([]);
    expect(result.errors).toEqual([
      { row: 1, message: "交易日期格式錯誤：「01/01/2026」" },
      { row: 2, message: "股數格式錯誤：「abc」" },
      { row: 3, message: "價格格式錯誤：「xyz」" },
    ]);
  });

  test("a file mixing valid and invalid rows keeps the valid ones and reports the rest", () => {
    const csv = [
      "trade_date,market,symbol,side,quantity,price",
      "2026-01-01,TW,2330,BUY,100,500",
      "2026-01-02,JP,2330,BUY,100,500",
      "2026-01-03,US,AAPL,SELL,10,160",
    ].join("\n");

    const result = parseTransactionsCsv(csv);

    expect(result.transactions).toEqual([
      {
        tradeDate: "2026-01-01",
        market: "TW",
        symbol: "2330",
        side: "BUY",
        quantity: 100,
        price: 500,
      },
      {
        tradeDate: "2026-01-03",
        market: "US",
        symbol: "AAPL",
        side: "SELL",
        quantity: 10,
        price: 160,
      },
    ]);
    expect(result.errors).toEqual([{ row: 2, message: "市場欄位錯誤：「JP」" }]);
  });
});
