import { expect, test } from "vitest";
import { Store } from "./store.js";

function memStore(): Store {
  const store = new Store(":memory:");
  store.init();
  return store;
}

function request(store: Store, sessionId: string, over: Partial<Record<string, unknown>> = {}) {
  store.recordMessage({
    sessionId,
    direction: "client_to_server",
    kind: "request",
    method: "tools/call",
    toolName: "read_file",
    jsonrpcId: "7",
    ts: 1000,
    payload: '{"id":7}',
    estTokens: 5,
    byteSize: 8,
    ...over,
  });
}

test("pairs a request with its response into one exchange with duration and tokens", () => {
  const store = memStore();
  const s = store.startSession({ serverLabel: "fs", serverCmd: "x" });

  request(store, s);
  store.recordMessage({
    sessionId: s,
    direction: "server_to_client",
    kind: "response",
    method: null,
    toolName: null,
    jsonrpcId: "7",
    ts: 1150,
    payload: '{"id":7,"result":{}}',
    estTokens: 20,
    byteSize: 20,
  });

  const exchanges = store.getExchanges(s);
  expect(exchanges).toHaveLength(1);
  expect(exchanges[0]).toMatchObject({
    jsonrpcId: "7",
    method: "tools/call",
    toolName: "read_file",
    durationMs: 150,
    isError: false,
    reqTokens: 5,
    respTokens: 20,
  });
  store.close();
});

test("marks an error response as an error exchange", () => {
  const store = memStore();
  const s = store.startSession({ serverLabel: "fs", serverCmd: "x" });

  request(store, s);
  store.recordMessage({
    sessionId: s,
    direction: "server_to_client",
    kind: "error",
    method: null,
    toolName: null,
    jsonrpcId: "7",
    ts: 1100,
    payload: '{"id":7,"error":{"code":-32601}}',
    estTokens: 8,
    byteSize: 12,
  });

  const exchanges = store.getExchanges(s);
  expect(exchanges).toHaveLength(1);
  expect(exchanges[0]).toMatchObject({ isError: true, durationMs: 100 });
  store.close();
});

test("leaves an unanswered request as a pending exchange", () => {
  const store = memStore();
  const s = store.startSession({ serverLabel: "fs", serverCmd: "x" });

  request(store, s);

  const exchanges = store.getExchanges(s);
  expect(exchanges).toHaveLength(1);
  expect(exchanges[0]).toMatchObject({
    jsonrpcId: "7",
    durationMs: null,
    responseMsgId: null,
    respTokens: null,
  });
  store.close();
});

test("does not create exchanges for notifications (no id)", () => {
  const store = memStore();
  const s = store.startSession({ serverLabel: "fs", serverCmd: "x" });

  store.recordMessage({
    sessionId: s,
    direction: "client_to_server",
    kind: "notification",
    method: "notifications/initialized",
    toolName: null,
    jsonrpcId: null,
    ts: 1000,
    payload: "{}",
    byteSize: 2,
  });

  expect(store.getExchanges(s)).toHaveLength(0);
  store.close();
});
