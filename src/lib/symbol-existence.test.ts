import { describe, expect, test } from "vitest";
import { resolveSymbolExistence } from "./symbol-existence";

describe("resolveSymbolExistence", () => {
  test("US-style single source: found and responded means it exists", () => {
    expect(resolveSymbolExistence([{ responded: true, found: true }])).toEqual({
      exists: true,
      confirmedAbsent: false,
    });
  });

  test("US-style single source: responded but not found means confirmed absent", () => {
    expect(resolveSymbolExistence([{ responded: true, found: false }])).toEqual({
      exists: false,
      confirmedAbsent: true,
    });
  });

  test("US-style single source: did not respond means undetermined (never blocks)", () => {
    expect(resolveSymbolExistence([{ responded: false, found: false }])).toEqual({
      exists: false,
      confirmedAbsent: false,
    });
  });

  test("TW-style two sources: either one finding it means it exists, regardless of the other", () => {
    expect(
      resolveSymbolExistence([
        { responded: true, found: true },
        { responded: false, found: false },
      ]),
    ).toEqual({ exists: true, confirmedAbsent: false });

    expect(
      resolveSymbolExistence([
        { responded: true, found: false },
        { responded: true, found: true },
      ]),
    ).toEqual({ exists: true, confirmedAbsent: false });
  });

  test("TW-style two sources: both responded, neither found it — confirmed absent", () => {
    expect(
      resolveSymbolExistence([
        { responded: true, found: false },
        { responded: true, found: false },
      ]),
    ).toEqual({ exists: false, confirmedAbsent: true });
  });

  test("TW-style two sources: one didn't respond and neither found it — undetermined, not blocked", () => {
    expect(
      resolveSymbolExistence([
        { responded: true, found: false },
        { responded: false, found: false },
      ]),
    ).toEqual({ exists: false, confirmedAbsent: false });
  });

  test("no sources consulted is undetermined, not confirmed absent (guards against vacuous truth)", () => {
    expect(resolveSymbolExistence([])).toEqual({
      exists: false,
      confirmedAbsent: false,
    });
  });
});
