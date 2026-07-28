import type { TransactionInput } from "./pnl";

export type CsvTransaction = TransactionInput;

export interface CsvParseError {
  row: number;
  message: string;
}

export interface CsvParseResult {
  transactions: CsvTransaction[];
  errors: CsvParseError[];
}

const REQUIRED_COLUMNS = [
  "trade_date",
  "market",
  "symbol",
  "side",
  "quantity",
  "price",
] as const;

export const TRADE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseTransactionsCsv(csvText: string): CsvParseResult {
  const lines = csvText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const header = lines[0]?.split(",").map((cell) => cell.trim()) ?? [];
  const missingColumns = REQUIRED_COLUMNS.filter(
    (column) => !header.includes(column),
  );

  if (missingColumns.length > 0) {
    return {
      transactions: [],
      errors: [
        {
          row: 0,
          message: `Missing required column(s): ${missingColumns.join(", ")}`,
        },
      ],
    };
  }

  const columnIndex = Object.fromEntries(
    REQUIRED_COLUMNS.map((column) => [column, header.indexOf(column)]),
  ) as Record<(typeof REQUIRED_COLUMNS)[number], number>;

  const transactions: CsvTransaction[] = [];
  const errors: CsvParseError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = i;
    const cells = lines[i].split(",").map((cell) => cell.trim());

    const tradeDate = cells[columnIndex.trade_date];
    const market = cells[columnIndex.market];
    const symbol = cells[columnIndex.symbol];
    const side = cells[columnIndex.side];
    const quantityRaw = cells[columnIndex.quantity];
    const priceRaw = cells[columnIndex.price];

    if (!TRADE_DATE_PATTERN.test(tradeDate)) {
      errors.push({ row, message: `Invalid trade_date: "${tradeDate}"` });
      continue;
    }
    if (market !== "TW" && market !== "US") {
      errors.push({ row, message: `Invalid market: "${market}"` });
      continue;
    }
    if (side !== "BUY" && side !== "SELL") {
      errors.push({ row, message: `Invalid side: "${side}"` });
      continue;
    }
    if (!symbol) {
      errors.push({ row, message: "Missing symbol" });
      continue;
    }

    const quantity = Number(quantityRaw);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      errors.push({ row, message: `Invalid quantity: "${quantityRaw}"` });
      continue;
    }

    const price = Number(priceRaw);
    if (!Number.isFinite(price) || price <= 0) {
      errors.push({ row, message: `Invalid price: "${priceRaw}"` });
      continue;
    }

    transactions.push({ tradeDate, market, symbol, side, quantity, price });
  }

  return { transactions, errors };
}
