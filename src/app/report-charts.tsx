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
const OTHER_SLICE_COLOR = "#898781"; // muted ink token — a residual bucket, not a series identity
const OTHER_LABEL = "其他";
const MAX_PIE_SLICES = 8;

// Diverging red(gain)/green(loss) — matches this app's existing pnlColor
// convention (Taiwan stock-market convention), re-validated for CVD/contrast
// against this app's own surfaces rather than the skill's default blue↔red pair.
const RETURN_POSITIVE = { light: "#e34948", dark: "#e66767" };
const RETURN_NEGATIVE = { light: "#008300", dark: "#008300" };

function formatPercent(v: unknown): string {
  const n = typeof v === "number" ? v : Number(v);
  return `${n.toFixed(1)}%`;
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

export function ReportCharts({ byStock }: { byStock: StockPnl[] }) {
  const dark = usePrefersDark();
  const categorical = dark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT;
  const gridColor = dark ? "#2c2c2a" : "#e1e0d9";
  const axisTextColor = dark ? "#c3c2b7" : "#52514e";
  const tooltipBg = dark ? "#1a1a19" : "#fcfcfb";

  const returnRateData = byStock
    .filter((s): s is StockPnl & { returnRatePercent: number } => s.returnRatePercent !== null)
    .map((s) => ({ symbol: s.symbol, value: s.returnRatePercent }));

  const allocationRaw = byStock
    .filter((s): s is StockPnl & { allocationPercent: number } => s.allocationPercent !== null)
    .map((s) => ({ symbol: s.symbol, value: s.allocationPercent }))
    .sort((a, b) => b.value - a.value);

  const allocationData =
    allocationRaw.length > MAX_PIE_SLICES
      ? [
          ...allocationRaw.slice(0, MAX_PIE_SLICES - 1),
          {
            symbol: OTHER_LABEL,
            value: allocationRaw
              .slice(MAX_PIE_SLICES - 1)
              .reduce((sum, d) => sum + d.value, 0),
          },
        ]
      : allocationRaw;

  if (returnRateData.length === 0 && allocationData.length === 0) {
    return null;
  }

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {returnRateData.length > 0 && (
        <div className="rounded-lg border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-900">
          <h2 className="mb-2 text-sm font-medium text-zinc-500">報酬率</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={returnRateData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="symbol"
                tick={{ fill: axisTextColor, fontSize: 12 }}
                axisLine={{ stroke: gridColor }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: axisTextColor, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                formatter={(v) => [formatPercent(v), "報酬率"]}
                cursor={{ fill: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}
                contentStyle={{
                  background: tooltipBg,
                  border: "none",
                  borderRadius: 8,
                  color: axisTextColor,
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={24}>
                {returnRateData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={
                      d.value >= 0
                        ? dark
                          ? RETURN_POSITIVE.dark
                          : RETURN_POSITIVE.light
                        : dark
                          ? RETURN_NEGATIVE.dark
                          : RETURN_NEGATIVE.light
                    }
                  />
                ))}
                <LabelList
                  dataKey="value"
                  position="top"
                  formatter={(v: unknown) => {
                    const n = typeof v === "number" ? v : Number(v);
                    return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
                  }}
                  fill={axisTextColor}
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
                  background: tooltipBg,
                  border: "none",
                  borderRadius: 8,
                  color: axisTextColor,
                }}
              />
              <Legend
                formatter={(value: string) => (
                  <span style={{ color: axisTextColor }}>{value}</span>
                )}
              />
              <Pie
                data={allocationData}
                dataKey="value"
                nameKey="symbol"
                outerRadius={80}
                label={(entry) => `${entry.name} ${((entry.percent ?? 0) * 100).toFixed(0)}%`}
              >
                {allocationData.map((d, i) => (
                  <Cell
                    key={d.symbol}
                    fill={
                      d.symbol === OTHER_LABEL
                        ? OTHER_SLICE_COLOR
                        : categorical[i % categorical.length]
                    }
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
