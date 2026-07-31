import { describe, expect, test } from "vitest";
import { shouldRunDailyScan } from "./dividend-scan";

describe("shouldRunDailyScan", () => {
  test("returns true when there's no prior run", () => {
    expect(shouldRunDailyScan(null, "2026-07-31")).toBe(true);
  });

  test("returns false when the last run was today", () => {
    expect(shouldRunDailyScan("2026-07-31", "2026-07-31")).toBe(false);
  });

  test("returns true when the last run was an earlier day", () => {
    expect(shouldRunDailyScan("2026-07-30", "2026-07-31")).toBe(true);
  });
});
