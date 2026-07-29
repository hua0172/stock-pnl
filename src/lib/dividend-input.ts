import { TRADE_DATE_PATTERN } from "./csv";
import type { DividendInput, Market } from "./pnl";

export interface RawDividendInput {
  paymentDate: string;
  market: string;
  symbol: string;
  amount: string | number;
}

export type ValidateDividendInputResult =
  | { value: DividendInput; error?: undefined }
  | { value?: undefined; error: string };

export function validateDividendInput(
  raw: RawDividendInput,
): ValidateDividendInputResult {
  const paymentDate = raw.paymentDate;
  const market = raw.market as Market;
  const symbol = raw.symbol.trim();
  const amount = typeof raw.amount === "number" ? raw.amount : Number(raw.amount);

  if (!TRADE_DATE_PATTERN.test(paymentDate)) {
    return { error: "發放日期格式必須是 YYYY-MM-DD。" };
  }
  if (market !== "TW" && market !== "US") {
    return { error: "市場欄位必須是 TW 或 US。" };
  }
  if (!symbol) {
    return { error: "請輸入股票代號。" };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "股息金額必須是正數。" };
  }

  return { value: { paymentDate, market, symbol, amount } };
}
