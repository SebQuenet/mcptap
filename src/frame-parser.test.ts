import { expect, test } from "vitest";
import { FrameParser } from "./frame-parser.js";

test("emits one json frame for a single newline-delimited message", () => {
  const parser = new FrameParser();

  const frames = parser.push('{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n');

  expect(frames).toHaveLength(1);
  expect(frames[0]).toEqual({
    kind: "json",
    raw: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}',
    message: { jsonrpc: "2.0", id: 1, method: "tools/list" },
  });
});

test("emits a malformed frame for an unparseable line without throwing", () => {
  const parser = new FrameParser();

  const frames = parser.push("not json at all\n");

  expect(frames).toEqual([{ kind: "malformed", raw: "not json at all" }]);
});

test("skips blank and whitespace-only lines", () => {
  const parser = new FrameParser();

  const frames = parser.push('\n  \n{"jsonrpc":"2.0","id":1}\n');

  expect(frames).toEqual([
    { kind: "json", raw: '{"jsonrpc":"2.0","id":1}', message: { jsonrpc: "2.0", id: 1 } },
  ]);
});

test("emits multiple frames from a single chunk", () => {
  const parser = new FrameParser();

  const frames = parser.push('{"id":1}\n{"id":2}\n');

  expect(frames.map((f) => f.kind === "json" && f.message)).toEqual([{ id: 1 }, { id: 2 }]);
});

test("buffers a partial line until its newline arrives across pushes", () => {
  const parser = new FrameParser();

  expect(parser.push('{"id":')).toEqual([]);
  expect(parser.push("42}\n")).toEqual([
    { kind: "json", raw: '{"id":42}', message: { id: 42 } },
  ]);
});
