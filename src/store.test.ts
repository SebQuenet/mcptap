import { expect, test } from "vitest";
import { Store } from "./store.js";

function memStore(): Store {
  const store = new Store(":memory:");
  store.init();
  return store;
}

test("records a message and reads it back within a session", () => {
  const store = memStore();
  const sessionId = store.startSession({ serverLabel: "fs", serverCmd: "node server.js" });

  store.recordMessage({
    sessionId,
    direction: "client_to_server",
    kind: "request",
    method: "tools/list",
    toolName: null,
    jsonrpcId: "1",
    ts: 1000,
    payload: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}',
    byteSize: 46,
  });

  const rows = store.getMessages(sessionId);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    direction: "client_to_server",
    kind: "request",
    method: "tools/list",
    toolName: null,
    jsonrpcId: "1",
    ts: 1000,
    payload: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}',
    byteSize: 46,
  });
  store.close();
});

test("startSession returns distinct ids and isolates messages per session", () => {
  const store = memStore();
  const a = store.startSession({ serverLabel: "fs", serverCmd: "x" });
  const b = store.startSession({ serverLabel: "gh", serverCmd: "y" });
  expect(a).not.toBe(b);

  store.recordMessage({
    sessionId: a,
    direction: "server_to_client",
    kind: "response",
    method: null,
    toolName: null,
    jsonrpcId: "1",
    ts: 1,
    payload: "{}",
    byteSize: 2,
  });

  expect(store.getMessages(a)).toHaveLength(1);
  expect(store.getMessages(b)).toHaveLength(0);
  store.close();
});
