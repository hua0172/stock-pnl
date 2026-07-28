import { fetchYahooChart } from "./yahoo";

export type Currency = "TWD" | "USD";

const USD_TWD_SYMBOL = "TWD=X";

export async function fetchCurrentFxRate(
  currency: Currency,
): Promise<number> {
  if (currency === "TWD") return 1;

  const result = await fetchYahooChart(USD_TWD_SYMBOL, "5d");
  const rate = result.meta.regularMarketPrice;

  if (typeof rate !== "number") {
    throw new Error("No current USD/TWD rate available");
  }

  return rate;
}

export async function fetchHistoricalFxRate(
  date: string,
  currency: Currency,
): Promise<number> {
  if (currency === "TWD") return 1;

  const result = await fetchYahooChart(USD_TWD_SYMBOL, "max");
  const targetSeconds = Date.parse(`${date}T23:59:59Z`) / 1000;
  const { timestamp, indicators } = result;
  const closes = indicators.quote[0].close;

  let bestIndex = -1;
  for (let i = 0; i < timestamp.length; i++) {
    if (timestamp[i] <= targetSeconds && closes[i] != null) {
      bestIndex = i;
    }
  }

  if (bestIndex === -1) {
    throw new Error(`No USD/TWD rate available on or before ${date}`);
  }

  return closes[bestIndex] as number;
}
