"use client";

import { useState } from "react";
import { lookupSymbolName } from "@/app/symbol-actions";
import type { Market } from "@/lib/pnl";

// Shared by the transaction and dividend add/edit forms — the market select
// and symbol input always travel together (the lookup needs both), and this
// is the one place the live blur-lookup behavior lives.
export function SymbolMarketFields({
  market,
  onMarketChange,
  symbol,
  onSymbolChange,
}: {
  market: Market;
  onMarketChange: (market: Market) => void;
  symbol: string;
  onSymbolChange: (symbol: string) => void;
}) {
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  async function handleSymbolBlur() {
    if (!symbol) {
      setResolvedName(null);
      return;
    }
    setIsLookingUp(true);
    const name = await lookupSymbolName(market, symbol);
    setResolvedName(name);
    setIsLookingUp(false);
  }

  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        市場
        <select
          name="market"
          required
          value={market}
          onChange={(e) => onMarketChange(e.target.value as Market)}
          className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-zinc-800"
        >
          <option value="TW">台股（TW）</option>
          <option value="US">美股（US）</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        股票代號
        <input
          type="text"
          name="symbol"
          required
          placeholder="例如 2330 或 AAPL"
          value={symbol}
          onChange={(e) => onSymbolChange(e.target.value)}
          onBlur={handleSymbolBlur}
          className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-zinc-800"
        />
        {isLookingUp && (
          <span className="text-xs text-zinc-500">查詢名稱中…</span>
        )}
        {!isLookingUp && resolvedName && (
          <span className="text-xs text-zinc-500">{resolvedName}</span>
        )}
      </label>
    </>
  );
}
