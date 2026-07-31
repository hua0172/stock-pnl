import { createDividend } from "./dividend-write";
import { shouldRunDailyScan } from "./dividend-scan";
import { quantityHeldAsOf, QUANTITY_EPSILON, type Market, type TransactionInput } from "./pnl";
import { prisma } from "./prisma";
import { fetchJsonWithTimeout } from "./symbol-name";
import { buildYahooChartUrl, YAHOO_USER_AGENT } from "./yahoo";

export interface ExDividendEvent {
  symbol: string;
  exDate: string;
  cashDividendPerShare: number;
}

// TWSE dates are ROC-calendar YYYMMDD (e.g. "1150731" → ROC year 115 → 2026),
// always 7 digits since ROC year 100 (2011) — no other TWSE/TPEx endpoint
// used elsewhere in this app has needed converting, so this is new here.
function rocDateToIso(rocDate: string): string {
  const year = Number(rocDate.slice(0, 3)) + 1911;
  const month = rocDate.slice(3, 5);
  const day = rocDate.slice(5, 7);
  return `${year}-${month}-${day}`;
}

// Shared by both TWSE and TPEx row parsers below — only the raw field names
// differ between the two sources, not this decision. A row whose ex-dividend
// type is rights-only (no cash component), or whose cash amount is blank/
// zero (announced but not yet priced), never becomes an event.
function toExDividendEvent(params: {
  symbol: string;
  rocDate: string;
  exDividendType: string;
  cashDividendTypes: Set<string>;
  cashDividendRaw: string;
}): ExDividendEvent | null {
  if (!params.cashDividendTypes.has(params.exDividendType)) return null;

  const cashDividendPerShare = Number(params.cashDividendRaw);
  if (!params.cashDividendRaw || !Number.isFinite(cashDividendPerShare) || cashDividendPerShare <= 0) {
    return null;
  }

  return { symbol: params.symbol, exDate: rocDateToIso(params.rocDate), cashDividendPerShare };
}

interface TwseTwt48uRow {
  Date: string;
  Code: string;
  Exdividend: string;
  CashDividend: string;
}

const TWSE_CASH_DIVIDEND_TYPES = new Set(["息", "權息"]);

export function parseTwseExDividendRows(rows: TwseTwt48uRow[]): ExDividendEvent[] {
  const events: ExDividendEvent[] = [];
  for (const row of rows) {
    const event = toExDividendEvent({
      symbol: row.Code,
      rocDate: row.Date,
      exDividendType: row.Exdividend,
      cashDividendTypes: TWSE_CASH_DIVIDEND_TYPES,
      cashDividendRaw: row.CashDividend,
    });
    if (event) events.push(event);
  }
  return events;
}

interface TpexExrightPrepostRow {
  ExRrightsExDividendDate: string;
  SecuritiesCompanyCode: string;
  ExRrightsExDividend: string;
  CashDividend: string;
}

const TPEX_CASH_DIVIDEND_TYPES = new Set(["除息", "除權息"]);

export function parseTpexExDividendRows(rows: TpexExrightPrepostRow[]): ExDividendEvent[] {
  const events: ExDividendEvent[] = [];
  for (const row of rows) {
    const event = toExDividendEvent({
      symbol: row.SecuritiesCompanyCode,
      rocDate: row.ExRrightsExDividendDate,
      exDividendType: row.ExRrightsExDividend,
      cashDividendTypes: TPEX_CASH_DIVIDEND_TYPES,
      cashDividendRaw: row.CashDividend,
    });
    if (event) events.push(event);
  }
  return events;
}

const TWSE_TWT48U_ALL_URL = "https://openapi.twse.com.tw/v1/exchangeReport/TWT48U_ALL";
const TPEX_EXRIGHT_PREPOST_URL = "https://www.tpex.org.tw/openapi/v1/tpex_exright_prepost";

export interface TwExDividendFetchResult {
  events: ExDividendEvent[];
  errors: string[];
}

// fetchJsonWithTimeout collapses every failure mode (timeout, network error,
// non-ok status) into a single `null` — that's fine for the purely cosmetic
// name lookup it was originally written for, but a dividend scan needs the
// failure itself surfaced, not silently treated as "no events today."
export async function fetchTwExDividendEvents(): Promise<TwExDividendFetchResult> {
  const [twseData, tpexData] = await Promise.all([
    fetchJsonWithTimeout(TWSE_TWT48U_ALL_URL),
    fetchJsonWithTimeout(TPEX_EXRIGHT_PREPOST_URL),
  ]);

  const events: ExDividendEvent[] = [];
  const errors: string[] = [];

  if (Array.isArray(twseData)) {
    events.push(...parseTwseExDividendRows(twseData as TwseTwt48uRow[]));
  } else {
    errors.push("自動股息偵測失敗：無法取得 TWSE 除權除息預告資料");
  }

  if (Array.isArray(tpexData)) {
    events.push(...parseTpexExDividendRows(tpexData as TpexExrightPrepostRow[]));
  } else {
    errors.push("自動股息偵測失敗：無法取得 TPEx 除權除息預告資料");
  }

  return { events, errors };
}

interface YahooChartDividendsResponse {
  chart: {
    result?: Array<{
      events?: {
        dividends?: Record<string, { amount: number; date: number }>;
      };
    }>;
  };
}

// A rolling few-month window, same idea as TW's own "prepost" tables above —
// Yahoo doesn't offer a free deep archive either, so this only ever tracks
// dividends from around now onward.
const US_DIVIDEND_EVENTS_RANGE = "3mo";

// Deliberately not reusing fetchYahooChart: dividend events aren't part of
// its YahooChartResult type. Throws on any failure (network error, non-ok
// status) rather than swallowing it — per ADR-0003, a Yahoo Finance failure
// gets surfaced to the caller rather than silently treated as "no dividends,"
// mirroring how price/FX fetch failures are already surfaced on the report
// page. A symbol with genuinely no dividends still just resolves to [].
export async function fetchUsExDividendEvents(symbol: string): Promise<ExDividendEvent[]> {
  const url = buildYahooChartUrl(symbol, US_DIVIDEND_EVENTS_RANGE, { events: "div" });
  const res = await fetch(url, { headers: { "User-Agent": YAHOO_USER_AGENT } });
  if (!res.ok) {
    throw new Error(`無法連線至 Yahoo Finance（「${symbol}」）：${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as YahooChartDividendsResponse;
  const dividends = data.chart.result?.[0]?.events?.dividends;
  if (!dividends) return [];

  return Object.values(dividends).map((d) => ({
    symbol,
    exDate: new Date(d.date * 1000).toISOString().slice(0, 10),
    cashDividendPerShare: d.amount,
  }));
}

// Every distinct (symbol, market) pair ever transacted — not just
// currently-held symbols, since a symbol fully sold since could still have
// been held as of a past ex-dividend date within the source's rolling window.
async function transactedSymbolsByMarket(): Promise<Map<Market, string[]>> {
  const rows = await prisma.transaction.findMany({ select: { market: true, symbol: true } });
  const bySymbol = new Map<Market, Set<string>>();

  for (const row of rows) {
    const market = row.market as Market;
    const symbols = bySymbol.get(market) ?? new Set<string>();
    symbols.add(row.symbol);
    bySymbol.set(market, symbols);
  }

  return new Map([...bySymbol].map(([market, symbols]) => [market, [...symbols]]));
}

async function transactionInputsFor(symbol: string): Promise<TransactionInput[]> {
  const rows = await prisma.transaction.findMany({ where: { symbol } });
  return rows.map((r) => ({
    tradeDate: r.tradeDate.toISOString().slice(0, 10),
    market: r.market as Market,
    symbol: r.symbol,
    side: r.side as "BUY" | "SELL",
    quantity: r.quantity,
    price: r.price,
  }));
}

// Fail-open: any single event that can't be processed (an unreachable data
// source when fetching this symbol's transactions, or a failed historical FX
// lookup) is skipped with a message, never thrown — one bad event must never
// abort the whole scan, matching this app's fail-open conventions elsewhere.
async function createDividendEventSafely(
  market: Market,
  event: ExDividendEvent,
  errors: string[],
): Promise<void> {
  try {
    await createDividendIfMissing(market, event);
  } catch (err) {
    errors.push(`自動股息偵測失敗（${event.symbol}，${event.exDate}）：${(err as Error).message}`);
  }
}

export async function detectAndCreateMissingDividends(): Promise<string[]> {
  const errors: string[] = [];
  const symbolsByMarket = await transactedSymbolsByMarket();

  const twSymbols = new Set(symbolsByMarket.get("TW") ?? []);
  if (twSymbols.size > 0) {
    const tw = await fetchTwExDividendEvents();
    errors.push(...tw.errors);

    for (const event of tw.events) {
      if (!twSymbols.has(event.symbol)) continue;
      await createDividendEventSafely("TW", event, errors);
    }
  }

  const usSymbols = symbolsByMarket.get("US") ?? [];
  for (const symbol of usSymbols) {
    let usEvents: ExDividendEvent[];
    try {
      usEvents = await fetchUsExDividendEvents(symbol);
    } catch (err) {
      errors.push(`自動股息偵測失敗（${symbol}）：${(err as Error).message}`);
      continue;
    }

    for (const event of usEvents) {
      await createDividendEventSafely("US", event, errors);
    }
  }

  return errors;
}

const DIVIDEND_SCAN_STATE_ID = 1;

// Called on every report-page load; only actually scans once per calendar
// day (persisted, so it survives a server restart), and never throws — a
// scan failure surfaces as an error message the caller can show alongside
// the existing price/FX errors, not a crash.
export async function runDailyDividendScanIfNeeded(): Promise<string[]> {
  const today = new Date().toISOString().slice(0, 10);
  const state = await prisma.dividendScanState.findUnique({
    where: { id: DIVIDEND_SCAN_STATE_ID },
  });
  const lastRunDate = state?.lastRunDate?.toISOString().slice(0, 10) ?? null;

  if (!shouldRunDailyScan(lastRunDate, today)) {
    return [];
  }

  const errors = await detectAndCreateMissingDividends();

  await prisma.dividendScanState.upsert({
    where: { id: DIVIDEND_SCAN_STATE_ID },
    create: { id: DIVIDEND_SCAN_STATE_ID, lastRunDate: new Date(today) },
    update: { lastRunDate: new Date(today) },
  });

  return errors;
}

async function createDividendIfMissing(market: Market, event: ExDividendEvent): Promise<void> {
  const transactions = await transactionInputsFor(event.symbol);
  const heldQuantity = quantityHeldAsOf(transactions, event.exDate);
  if (heldQuantity <= QUANTITY_EPSILON) return;

  const existing = await prisma.dividend.findFirst({
    where: { symbol: event.symbol, market, paymentDate: new Date(event.exDate) },
  });
  if (existing) return;

  const amount = event.cashDividendPerShare * heldQuantity;
  await createDividend({ paymentDate: event.exDate, market, symbol: event.symbol, amount });
}
