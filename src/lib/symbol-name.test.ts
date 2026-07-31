import { describe, expect, test } from "vitest";
import { formatSymbolLabel, isCacheFresh } from "./symbol-name";

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

describe("isCacheFresh", () => {
  const ttlMs = 24 * 60 * 60 * 1000;

  test("is fresh just inside the TTL", () => {
    const fetchedAt = 1_000_000;
    const now = fetchedAt + ttlMs - 1;
    expect(isCacheFresh(fetchedAt, ttlMs, now)).toBe(true);
  });

  test("is stale just past the TTL", () => {
    const fetchedAt = 1_000_000;
    const now = fetchedAt + ttlMs + 1;
    expect(isCacheFresh(fetchedAt, ttlMs, now)).toBe(false);
  });

  test("is stale exactly at the TTL boundary", () => {
    const fetchedAt = 1_000_000;
    const now = fetchedAt + ttlMs;
    expect(isCacheFresh(fetchedAt, ttlMs, now)).toBe(false);
  });
});
