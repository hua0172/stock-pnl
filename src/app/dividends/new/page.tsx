"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { addDividend, type DividendActionResult } from "@/app/dividend-actions";
import { SymbolMarketFields } from "@/app/symbol-market-fields";
import type { Market } from "@/lib/pnl";

const initialState: DividendActionResult = {};

export default function NewDividendPage() {
  const [state, formAction, pending] = useActionState(
    addDividend,
    initialState,
  );
  const [market, setMarket] = useState<Market>("TW");
  const [symbol, setSymbol] = useState("");

  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-50 p-8 font-sans dark:bg-black">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          新增股息
        </h1>
        <Link href="/" className="text-sm underline">
          回報表頁
        </Link>
      </header>

      <form
        action={formAction}
        className="flex max-w-md flex-col gap-4 rounded-lg border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-900"
      >
        <label className="flex flex-col gap-1 text-sm">
          發放日期
          <input
            type="date"
            name="paymentDate"
            required
            className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-zinc-800"
          />
        </label>

        <SymbolMarketFields
          market={market}
          onMarketChange={setMarket}
          symbol={symbol}
          onSymbolChange={setSymbol}
        />

        <label className="flex flex-col gap-1 text-sm">
          金額（稅後實收，原幣別）
          <input
            type="number"
            name="amount"
            required
            min="0"
            step="any"
            className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-zinc-800"
          />
        </label>

        {state.error && (
          <p className="rounded bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {pending ? "儲存中…" : "儲存股息"}
        </button>
      </form>
    </div>
  );
}
