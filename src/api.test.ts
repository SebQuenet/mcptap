import { expect, test } from "vitest";
import { handleApiRequest } from "./api.js";
import { Store } from "./store.js";

function seededStore(): { store: Store; sessionId: string } {
  const store = new Store(":memory:");
  store.init();
  const sessionId = store.startSession({ serverLabel: "fs", serverCmd: "x" });
  store.recordMessage({
    sessionId,
    direction: "client_to_server",
    kind: "request",
    method: "tools/call",
    toolName: "read_file",
    jsonrpcId: "1",
    ts: 100,
    payload: '{"id":1,"method":"tools/call","params":{"name":"read_file"}}',
    estTokens: 5,
    byteSize: 1,
  });
  store.recordMessage({
    sessionId,
    direction: "server_to_client",
    kind: "response",
    method: null,
    toolName: null,
    jsonrpcId: "1",
    ts: 150,
    payload: '{"id":1,"result":{"content":"hello"}}',
    estTokens: 20,
    byteSize: 1,
  });
  return { store, sessionId };
}

const call = (store: Store, path: string, query = "") =>
  handleApiRequest(store, path, new URLSearchParams(query));

test("GET /api/timeline returns the timeline", () => {
  const { store } = seededStore();
  const res = call(store, "/api/timeline");
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
  expect((res.body as unknown[]).length).toBe(1);
  store.close();
});

test("GET /api/timeline honors filter params", () => {
  const { store } = seededStore();
  expect((call(store, "/api/timeline", "status=error").body as unknown[]).length).toBe(0);
  expect((call(store, "/api/timeline", "tool=read_file").body as unknown[]).length).toBe(1);
  store.close();
});

test("GET /api/cost returns the cost summary", () => {
  const { store } = seededStore();
  const res = call(store, "/api/cost");
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ exchangeCount: 1, totalTokens: 25 });
  store.close();
});

test("GET /api/exchange returns the full request and response payloads", () => {
  const { store, sessionId } = seededStore();
  const res = call(store, "/api/exchange", `session=${sessionId}&id=1`);
  expect(res.status).toBe(200);
  const messages = res.body as { direction: string; payload: string }[];
  expect(messages).toHaveLength(2);
  expect(messages[0]).toMatchObject({ direction: "client_to_server" });
  expect(messages[1].payload).toContain('"content":"hello"');
  store.close();
});

test("unknown API path returns 404", () => {
  const { store } = seededStore();
  expect(call(store, "/api/nope").status).toBe(404);
  store.close();
});
