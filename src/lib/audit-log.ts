import { MARKET_LABEL } from "./market";
import type { Market, Side } from "./pnl";
import { formatSymbolLabel } from "./symbol-name";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE";

export interface TransactionSnapshot {
  tradeDate: string;
  market: Market;
  symbol: string;
  side: Side;
  quantity: number;
  price: number;
  fxRate: number;
}

export interface AuditEntryInput {
  action: AuditAction;
  before: TransactionSnapshot | null;
  after: TransactionSnapshot | null;
}

export interface DescribedAuditEntry {
  actionLabel: string;
  summary: string;
}

const SIDE_LABEL: Record<Side, string> = { BUY: "買進", SELL: "賣出" };

export const ACTION_LABEL: Record<AuditAction, string> = {
  CREATE: "新增",
  UPDATE: "編輯",
  DELETE: "刪除",
};

// Shared by any snapshot-diffing audit entry (transactions, dividends, ...):
// lists every field that changed as "label：before → after", joined by "、".
export function describeFieldChanges<T extends object>(
  before: T,
  after: T,
  fieldLabels: Record<keyof T, string>,
  formatValue: (field: keyof T, value: unknown) => string,
): string {
  const fields = Object.keys(fieldLabels) as (keyof T)[];
  const changes = fields
    .filter((field) => before[field] !== after[field])
    .map(
      (field) =>
        `${fieldLabels[field]}：${formatValue(field, before[field])} → ${formatValue(field, after[field])}`,
    );

  return changes.join("、");
}

const FIELD_LABEL: Record<keyof TransactionSnapshot, string> = {
  tradeDate: "交易日期",
  market: "市場",
  symbol: "股票代號",
  side: "買賣別",
  quantity: "股數",
  price: "價格",
  fxRate: "匯率",
};

function describeTransaction(
  snapshot: TransactionSnapshot,
  names: Partial<Record<string, string>> | undefined,
): string {
  const symbolLabel = formatSymbolLabel(snapshot.symbol, names?.[snapshot.symbol]);
  return `${symbolLabel}（${MARKET_LABEL[snapshot.market]}），${SIDE_LABEL[snapshot.side]} ${snapshot.quantity} 股 @${snapshot.price}`;
}

function fieldValueLabel(
  field: keyof TransactionSnapshot,
  value: unknown,
  names: Partial<Record<string, string>> | undefined,
): string {
  if (field === "market") return MARKET_LABEL[value as Market];
  if (field === "side") return SIDE_LABEL[value as Side];
  if (field === "symbol") return formatSymbolLabel(value as string, names?.[value as string]);
  if (typeof value === "number") return String(Number(value.toFixed(4)));
  return String(value);
}

function describeChanges(
  before: TransactionSnapshot,
  after: TransactionSnapshot,
  names: Partial<Record<string, string>> | undefined,
): string {
  return describeFieldChanges(before, after, FIELD_LABEL, (field, value) =>
    fieldValueLabel(field, value, names),
  );
}

export function describeAuditEntry(
  entry: AuditEntryInput,
  names?: Partial<Record<string, string>>,
): DescribedAuditEntry {
  const actionLabel = ACTION_LABEL[entry.action];

  if (entry.action === "CREATE" && entry.after) {
    return { actionLabel, summary: `新增交易：${describeTransaction(entry.after, names)}` };
  }

  if (entry.action === "DELETE" && entry.before) {
    return { actionLabel, summary: `刪除交易：${describeTransaction(entry.before, names)}` };
  }

  if (entry.action === "UPDATE" && entry.before && entry.after) {
    return { actionLabel, summary: describeChanges(entry.before, entry.after, names) };
  }

  return { actionLabel, summary: "" };
}
