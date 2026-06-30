import type { AddressInfo } from "node:net";
import { expect, test } from "vitest";
import { startViewer } from "./server.js";
import { Store } from "./store.js";

function seededStore(): Store {
  const store = new Store(":memory:");
  store.init();
  const s = store.startSession({ serverLabel: "fs", serverCmd: "x" });
  store.recordMessage({
    sessionId: s,
    direction: "client_to_server",
    kind: "request",
    method: "tools/list",
    toolName: null,
    jsonrpcId: "1",
    ts: 100,
    payload: '{"id":1}',
    estTokens: 5,
    byteSize: 1,
  });
  return store;
}

test("startViewer binds to 127.0.0.1 only and serves the API", async () => {
  const store = seededStore();
  const server = await startViewer(store, 0);
  const addr = server.address() as AddressInfo;

  expect(addr.address).toBe("127.0.0.1");

  const res = await fetch(`http://127.0.0.1:${addr.port}/api/timeline`);
  expect(res.status).toBe(200);
  const body = (await res.json()) as unknown[];
  expect(body).toHaveLength(1);

  await new Promise<void>((resolve) => server.close(() => resolve()));
  store.close();
});

test("serves a 404 for unknown API routes", async () => {
  const store = seededStore();
  const server = await startViewer(store, 0);
  const addr = server.address() as AddressInfo;

  const res = await fetch(`http://127.0.0.1:${addr.port}/api/nope`);
  expect(res.status).toBe(404);

  await new Promise<void>((resolve) => server.close(() => resolve()));
  store.close();
});
