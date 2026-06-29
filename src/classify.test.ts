import { expect, test } from "vitest";
import { classifyMessage } from "./classify.js";

test("classifies a message with method and id as a request", () => {
  expect(classifyMessage({ jsonrpc: "2.0", id: 1, method: "tools/list" })).toEqual({
    kind: "request",
    method: "tools/list",
    jsonrpcId: "1",
    toolName: null,
  });
});

test("classifies a message with method and no id as a notification", () => {
  expect(classifyMessage({ jsonrpc: "2.0", method: "notifications/initialized" })).toEqual({
    kind: "notification",
    method: "notifications/initialized",
    jsonrpcId: null,
    toolName: null,
  });
});

test("classifies a message with a result as a response", () => {
  expect(classifyMessage({ jsonrpc: "2.0", id: 2, result: { tools: [] } })).toEqual({
    kind: "response",
    method: null,
    jsonrpcId: "2",
    toolName: null,
  });
});

test("classifies a message with an error as an error response", () => {
  expect(
    classifyMessage({ jsonrpc: "2.0", id: 3, error: { code: -32601, message: "x" } }),
  ).toEqual({
    kind: "error",
    method: null,
    jsonrpcId: "3",
    toolName: null,
  });
});

test("extracts the tool name from a tools/call request", () => {
  expect(
    classifyMessage({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "read_file", arguments: { path: "/x" } },
    }),
  ).toEqual({
    kind: "request",
    method: "tools/call",
    jsonrpcId: "4",
    toolName: "read_file",
  });
});
