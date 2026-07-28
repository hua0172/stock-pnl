import { MARKET_LABEL } from "./market";
import type { Market, Side } from "./pnl";

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

const ACTION_LABEL: Record<AuditAction, string> = {
  CREATE: "新增",
  UPDATE: "編輯",
  DELETE: "刪除",
};

const FIELD_LABEL: Record<keyof TransactionSnapshot, string> = {
  tradeDate: "交易日期",
  market: "市場",
  symbol: "股票代號",
  side: "買賣別",
  quantity: "股數",
  price: "價格",
  fxRate: "匯率",
};

function describeTransaction(snapshot: TransactionSnapshot): string {
  return `${snapshot.symbol}（${MARKET_LABEL[snapshot.market]}），${SIDE_LABEL[snapshot.side]} ${snapshot.quantity} 股 @${snapshot.price}`;
}

function fieldValueLabel(field: keyof TransactionSnapshot, value: unknown): string {
  if (field === "market") return MARKET_LABEL[value as Market];
  if (field === "side") return SIDE_LABEL[value as Side];
  if (typeof value === "number") return String(Number(value.toFixed(4)));
  return String(value);
}

function describeChanges(
  before: TransactionSnapshot,
  after: TransactionSnapshot,
): string {
  const fields = Object.keys(FIELD_LABEL) as (keyof TransactionSnapshot)[];
  const changes = fields
    .filter((field) => before[field] !== after[field])
    .map(
      (field) =>
        `${FIELD_LABEL[field]}：${fieldValueLabel(field, before[field])} → ${fieldValueLabel(field, after[field])}`,
    );

  return changes.join("、");
}

export function describeAuditEntry(entry: AuditEntryInput): DescribedAuditEntry {
  const actionLabel = ACTION_LABEL[entry.action];

  if (entry.action === "CREATE" && entry.after) {
    return { actionLabel, summary: `新增交易：${describeTransaction(entry.after)}` };
  }

  if (entry.action === "DELETE" && entry.before) {
    return { actionLabel, summary: `刪除交易：${describeTransaction(entry.before)}` };
  }

  if (entry.action === "UPDATE" && entry.before && entry.after) {
    return { actionLabel, summary: describeChanges(entry.before, entry.after) };
  }

  return { actionLabel, summary: "" };
}
