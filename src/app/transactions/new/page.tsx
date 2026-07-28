"use client";

import Link from "next/link";
import { useActionState } from "react";
import { addTransaction, type ActionResult } from "@/app/actions";

const initialState: ActionResult = {};

export default function NewTransactionPage() {
  const [state, formAction, pending] = useActionState(
    addTransaction,
    initialState,
  );

  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-50 p-8 font-sans dark:bg-black">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          Add transaction
        </h1>
        <Link href="/" className="text-sm underline">
          Back to report
        </Link>
      </header>

      <form
        action={formAction}
        className="flex max-w-md flex-col gap-4 rounded-lg border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-900"
      >
        <label className="flex flex-col gap-1 text-sm">
          Trade date
          <input
            type="date"
            name="tradeDate"
            required
            className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-zinc-800"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Market
          <select
            name="market"
            required
            className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-zinc-800"
          >
            <option value="TW">Taiwan (TW)</option>
            <option value="US">United States (US)</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Symbol
          <input
            type="text"
            name="symbol"
            required
            placeholder="e.g. 2330 or AAPL"
            className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-zinc-800"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Side
          <select
            name="side"
            required
            className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-zinc-800"
          >
            <option value="BUY">Buy</option>
            <option value="SELL">Sell</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Quantity (shares)
          <input
            type="number"
            name="quantity"
            required
            min="0"
            step="any"
            className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-zinc-800"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Price (original currency)
          <input
            type="number"
            name="price"
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
          {pending ? "Saving…" : "Save transaction"}
        </button>
      </form>
    </div>
  );
}
