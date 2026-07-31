"use client";

import { useSyncExternalStore } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { StockPnl } from "@/lib/pnl";
import { formatSymbolLabel } from "@/lib/symbol-name";

// Validated 8-slot categorical palette (dataviz skill reference palette),
// re-validated against this app's own chart surfaces (#ffffff / #0a0a0a).
const CATEGORICAL_LIGHT = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#4a3aa7",
  "#e34948",
];
const CATEGORICAL_DARK = [
  "#3987e5",
  "#d95926",
  "#199e70",
  "#c98500",
  "#d55181",
  "#008300",
  "#9085e9",
  "#e66767",
];

// Diverging red(gain)/green(loss) — matches this app's existing pnlColor
// convention (Taiwan stock-market convention), re-validated for CVD/contrast
// against this app's own surfaces rather than the skill's default blue↔red pair.
const RETURN_POSITIVE = { light: "#e34948", dark: "#e66767" };
const RETURN_NEGATIVE = { light: "#008300", dark: "#008300" };

const LIGHT_THEME = {
  categorical: CATEGORICAL_LIGHT,
  gridColor: "#e1e0d9",
  axisTextColor: "#52514e",
  tooltipBg: "#fcfcfb",
  cursorFill: "rgba(0,0,0,0.04)",
  returnPositive: RETURN_POSITIVE.light,
  returnNegative: RETURN_NEGATIVE.light,
};
const DARK_THEME = {
  categorical: CATEGORICAL_DARK,
  gridColor: "#2c2c2a",
  axisTextColor: "#c3c2b7",
  tooltipBg: "#1a1a19",
  cursorFill: "rgba(255,255,255,0.06)",
  returnPositive: RETURN_POSITIVE.dark,
  returnNegative: RETURN_NEGATIVE.dark,
};

function toNumber(v: unknown): number {
  return typeof v === "number" ? v : Number(v);
}

function formatPercent(v: unknown): string {
  return `${toNumber(v).toFixed(1)}%`;
}

function formatSignedPercent(v: unknown): string {
  const n = toNumber(v);
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function pickNonNull<K extends "returnRatePercent" | "allocationPercent">(
  byStock: StockPnl[],
  key: K,
  symbolNames: Partial<Record<string, string>>,
): { symbol: string; label: string; value: number }[] {
  return byStock
    .filter((s): s is StockPnl & Record<K, number> => s[key] !== null)
    .map((s) => ({
      symbol: s.symbol,
      label: formatSymbolLabel(s.symbol, symbolNames[s.symbol]),
      value: s[key],
    }));
}

function subscribeToColorScheme(callback: () => void): () => void {
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getPrefersDarkSnapshot(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getPrefersDarkServerSnapshot(): boolean {
  return false;
}

function usePrefersDark(): boolean {
  return useSyncExternalStore(
    subscribeToColorScheme,
    getPrefersDarkSnapshot,
    getPrefersDarkServerSnapshot,
  );
}

export function ReportCharts({
  byStock,
  symbolNames,
}: {
  byStock: StockPnl[];
  symbolNames: Partial<Record<string, string>>;
}) {
  const dark = usePrefersDark();
  const theme = dark ? DARK_THEME : LIGHT_THEME;

  const returnRateData = pickNonNull(byStock, "returnRatePercent", symbolNames);
  const allocationData = pickNonNull(byStock, "allocationPercent", symbolNames).sort(
    (a, b) => b.value - a.value,
  );

  if (returnRateData.length === 0 && allocationData.length === 0) {
    return null;
  }

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {returnRateData.length > 0 && (
        <div className="rounded-lg border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-900">
          <h2 className="mb-2 text-sm font-medium text-zinc-500">報酬率</h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={returnRateData} margin={{ top: 20, right: 8, left: 0, bottom: 60 }}>
              <CartesianGrid stroke={theme.gridColor} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: theme.axisTextColor, fontSize: 12 }}
                axisLine={{ stroke: theme.gridColor }}
                tickLine={false}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={70}
              />
              <YAxis
                tick={{ fill: theme.axisTextColor, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v}%`}
                domain={[
                  (min: number) => Math.floor(min - Math.max(Math.abs(min) * 0.15, 4)),
                  (max: number) => Math.ceil(max + Math.max(Math.abs(max) * 0.15, 4)),
                ]}
              />
              <Tooltip
                formatter={(v) => [formatPercent(v), "報酬率"]}
                cursor={{ fill: theme.cursorFill }}
                contentStyle={{
                  background: theme.tooltipBg,
                  border: "none",
                  borderRadius: 8,
                  color: theme.axisTextColor,
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={24}>
                {returnRateData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.value >= 0 ? theme.returnPositive : theme.returnNegative}
                  />
                ))}
                <LabelList
                  dataKey="value"
                  position="top"
                  formatter={formatSignedPercent}
                  fill={theme.axisTextColor}
                  fontSize={12}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-2 text-xs text-zinc-500">紅色為正報酬，綠色為負報酬</p>
        </div>
      )}

      {allocationData.length > 0 && (
        <div className="rounded-lg border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-900">
          <h2 className="mb-2 text-sm font-medium text-zinc-500">持股占比</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Tooltip
                formatter={(v) => [formatPercent(v), "占比"]}
                contentStyle={{
                  background: theme.tooltipBg,
                  border: "none",
                  borderRadius: 8,
                  color: theme.axisTextColor,
                }}
              />
              <Legend
                formatter={(value: string, entry: { payload?: { value?: unknown } }) => {
                  const percent = entry.payload?.value;
                  return (
                    <span style={{ color: theme.axisTextColor }}>
                      {value}
                      {percent !== undefined ? ` ${formatPercent(percent)}` : ""}
                    </span>
                  );
                }}
              />
              <Pie
                data={allocationData}
                dataKey="value"
                nameKey="label"
                outerRadius={80}
                label={
                  allocationData.length <= 4
                    ? (entry) => `${entry.name} ${((entry.percent ?? 0) * 100).toFixed(0)}%`
                    : false
                }
              >
                {allocationData.map((d, i) => (
                  <Cell key={d.symbol} fill={theme.categorical[i % theme.categorical.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
