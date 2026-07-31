"use server";

import type { Market } from "@/lib/pnl";
import { fetchSymbolNames } from "@/lib/symbol-name";

// Purely cosmetic, single-symbol lookup for the add/edit forms' live
// blur-lookup. Never throws — a failed or unmatched lookup returns null.
export async function lookupSymbolName(
  market: Market,
  symbol: string,
): Promise<string | null> {
  if (!symbol) return null;

  const names = await fetchSymbolNames([{ market, symbol }]);
  return names[symbol] ?? null;
}
