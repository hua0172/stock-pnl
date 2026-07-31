// `YYYY-MM-DD` strings compare correctly with plain `<`, matching how
// tradeDate/paymentDate are already compared throughout this app.
export function shouldRunDailyScan(lastRunDate: string | null, today: string): boolean {
  return lastRunDate === null || lastRunDate < today;
}
