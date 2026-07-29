import { ACTION_LABEL, describeFieldChanges, type AuditAction } from "./audit-log";
import { MARKET_LABEL } from "./market";
import type { Market } from "./pnl";

export interface DividendSnapshot {
  paymentDate: string;
  market: Market;
  symbol: string;
  amount: number;
  fxRate: number;
}

export interface DividendAuditEntryInput {
  action: AuditAction;
  before: DividendSnapshot | null;
  after: DividendSnapshot | null;
}

export interface DescribedAuditEntry {
  actionLabel: string;
  summary: string;
}

const FIELD_LABEL: Record<keyof DividendSnapshot, string> = {
  paymentDate: "發放日期",
  market: "市場",
  symbol: "股票代號",
  amount: "金額",
  fxRate: "匯率",
};

function describeDividend(snapshot: DividendSnapshot): string {
  return `${snapshot.symbol}（${MARKET_LABEL[snapshot.market]}），${snapshot.paymentDate} 收到 ${snapshot.amount}`;
}

function fieldValueLabel(field: keyof DividendSnapshot, value: unknown): string {
  if (field === "market") return MARKET_LABEL[value as Market];
  if (typeof value === "number") return String(Number(value.toFixed(4)));
  return String(value);
}

function describeChanges(before: DividendSnapshot, after: DividendSnapshot): string {
  return describeFieldChanges(before, after, FIELD_LABEL, fieldValueLabel);
}

export function describeDividendAuditEntry(
  entry: DividendAuditEntryInput,
): DescribedAuditEntry {
  const actionLabel = ACTION_LABEL[entry.action];

  if (entry.action === "CREATE" && entry.after) {
    return { actionLabel, summary: `新增股息：${describeDividend(entry.after)}` };
  }

  if (entry.action === "DELETE" && entry.before) {
    return { actionLabel, summary: `刪除股息：${describeDividend(entry.before)}` };
  }

  if (entry.action === "UPDATE" && entry.before && entry.after) {
    return { actionLabel, summary: describeChanges(entry.before, entry.after) };
  }

  return { actionLabel, summary: "" };
}
