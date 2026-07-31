import { describe, expect, test } from "vitest";
import { formatSymbolLabel } from "./symbol-name";

describe("formatSymbolLabel", () => {
  test("returns 名稱（代號） when a name is given", () => {
    expect(formatSymbolLabel("009816", "凱基台灣TOP50")).toBe(
      "凱基台灣TOP50（009816）",
    );
  });

  test("returns the bare symbol when no name is given", () => {
    expect(formatSymbolLabel("009816", undefined)).toBe("009816");
  });
});
