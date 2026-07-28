import { TRADE_DATE_PATTERN } from "./csv";
import type { Market, Side, TransactionInput } from "./pnl";

export interface RawTransactionInput {
  tradeDate: string;
  market: string;
  symbol: string;
  side: string;
  quantity: string | number;
  price: string | number;
}

export type ValidateTransactionInputResult =
  | { value: TransactionInput; error?: undefined }
  | { value?: undefined; error: string };

export function validateTransactionInput(
  raw: RawTransactionInput,
): ValidateTransactionInputResult {
  const tradeDate = raw.tradeDate;
  const market = raw.market as Market;
  const symbol = raw.symbol.trim();
  const side = raw.side as Side;
  const quantity = typeof raw.quantity === "number" ? raw.quantity : Number(raw.quantity);
  const price = typeof raw.price === "number" ? raw.price : Number(raw.price);

  if (!TRADE_DATE_PATTERN.test(tradeDate)) {
    return { error: "交易日期格式必須是 YYYY-MM-DD。" };
  }
  if (market !== "TW" && market !== "US") {
    return { error: "市場欄位必須是 TW 或 US。" };
  }
  if (!symbol) {
    return { error: "請輸入股票代號。" };
  }
  if (side !== "BUY" && side !== "SELL") {
    return { error: "買賣別必須是 BUY 或 SELL。" };
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { error: "股數必須是正數。" };
  }
  if (!Number.isFinite(price) || price <= 0) {
    return { error: "價格必須是正數。" };
  }

  return { value: { tradeDate, market, symbol, side, quantity, price } };
}
