import { expect, test } from "vitest";
import { estimateTokens } from "./tokens.js";

test("returns 0 tokens for an empty string", () => {
  expect(estimateTokens("")).toBe(0);
});

test("returns a positive token count for non-empty text", () => {
  expect(estimateTokens("hello world")).toBeGreaterThan(0);
});

test("counts more tokens for longer text", () => {
  const long = estimateTokens("the quick brown fox jumps over the lazy dog repeatedly");
  const short = estimateTokens("fox");
  expect(long).toBeGreaterThan(short);
});

test("is deterministic for the same input", () => {
  expect(estimateTokens("the quick brown fox")).toBe(estimateTokens("the quick brown fox"));
});
