import { describe, expect, test } from "vitest";
import { parseTpexExDividendRows, parseTwseExDividendRows } from "./dividend-detection";

describe("parseTwseExDividendRows", () => {
  test("keeps a cash-only (息) row with a cash amount, converting the ROC date", () => {
    const events = parseTwseExDividendRows([
      { Date: "1150731", Code: "00406A", Exdividend: "息", CashDividend: "0.128000" },
    ]);

    expect(events).toEqual([
      { symbol: "00406A", exDate: "2026-07-31", cashDividendPerShare: 0.128 },
    ]);
  });

  test("keeps a combined rights-and-cash (權息) row", () => {
    const events = parseTwseExDividendRows([
      { Date: "1150805", Code: "2330", Exdividend: "權息", CashDividend: "7.5" },
    ]);

    expect(events).toEqual([
      { symbol: "2330", exDate: "2026-08-05", cashDividendPerShare: 7.5 },
    ]);
  });

  test("drops a rights-only (權) row regardless of amount", () => {
    const events = parseTwseExDividendRows([
      { Date: "1150805", Code: "2330", Exdividend: "權", CashDividend: "7.5" },
    ]);

    expect(events).toEqual([]);
  });

  test("drops a cash-type row with a blank amount (not yet announced)", () => {
    const events = parseTwseExDividendRows([
      { Date: "1150805", Code: "00400A", Exdividend: "息", CashDividend: "" },
    ]);

    expect(events).toEqual([]);
  });

  test("drops a cash-type row with a zero amount", () => {
    const events = parseTwseExDividendRows([
      { Date: "1150805", Code: "00400A", Exdividend: "息", CashDividend: "0.00000000" },
    ]);

    expect(events).toEqual([]);
  });
});

describe("parseTpexExDividendRows", () => {
  test("keeps a cash-only (除息) row with a cash amount, converting the ROC date", () => {
    const events = parseTpexExDividendRows([
      {
        ExRrightsExDividendDate: "1150722",
        SecuritiesCompanyCode: "3402",
        ExRrightsExDividend: "除息",
        CashDividend: "6.00000000",
      },
    ]);

    expect(events).toEqual([
      { symbol: "3402", exDate: "2026-07-22", cashDividendPerShare: 6 },
    ]);
  });

  test("keeps a combined rights-and-cash (除權息) row", () => {
    const events = parseTpexExDividendRows([
      {
        ExRrightsExDividendDate: "1150722",
        SecuritiesCompanyCode: "3402",
        ExRrightsExDividend: "除權息",
        CashDividend: "1.20000000",
      },
    ]);

    expect(events).toEqual([
      { symbol: "3402", exDate: "2026-07-22", cashDividendPerShare: 1.2 },
    ]);
  });

  test("drops a rights-only (除權) row regardless of amount", () => {
    const events = parseTpexExDividendRows([
      {
        ExRrightsExDividendDate: "1150722",
        SecuritiesCompanyCode: "3402",
        ExRrightsExDividend: "除權",
        CashDividend: "6.00000000",
      },
    ]);

    expect(events).toEqual([]);
  });

  test("drops a cash-type row with a blank or zero amount", () => {
    const events = parseTpexExDividendRows([
      {
        ExRrightsExDividendDate: "1150722",
        SecuritiesCompanyCode: "3402",
        ExRrightsExDividend: "除息",
        CashDividend: "",
      },
      {
        ExRrightsExDividendDate: "1150722",
        SecuritiesCompanyCode: "3403",
        ExRrightsExDividend: "除息",
        CashDividend: "0.00000000",
      },
    ]);

    expect(events).toEqual([]);
  });
});
