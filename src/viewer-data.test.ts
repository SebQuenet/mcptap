import { expect, test } from "vitest";
import { Store } from "./store.js";

function memStore(): Store {
  const store = new Store(":memory:");
  store.init();
  return store;
}

interface SeedSpec {
  id: string;
  method?: string;
  tool?: string | null;
  reqTs: number;
  respTs?: number | null;
  error?: boolean;
  reqTok?: number;
  respTok?: number;
}

function seedExchange(store: Store, sessionId: string, spec: SeedSpec): void {
  store.recordMessage({
    sessionId,
    direction: "client_to_server",
    kind: "request",
    method: spec.method ?? "tools/call",
    toolName: spec.tool ?? null,
    jsonrpcId: spec.id,
    ts: spec.reqTs,
    payload: `{"id":${spec.id},"method":"${spec.method ?? "tools/call"}"}`,
    estTokens: spec.reqTok ?? 1,
    byteSize: 1,
  });
  if (spec.respTs != null) {
    store.recordMessage({
      sessionId,
      direction: "server_to_client",
      kind: spec.error ? "error" : "response",
      method: null,
      toolName: null,
      jsonrpcId: spec.id,
      ts: spec.respTs,
      payload: `{"id":${spec.id},"result":{}}`,
      estTokens: spec.respTok ?? 1,
      byteSize: 1,
    });
  }
}

test("getTimeline returns exchanges across sessions, newest first, with server label and status", () => {
  const store = memStore();
  const a = store.startSession({ serverLabel: "fs", serverCmd: "x", client: "cursor" });
  const b = store.startSession({ serverLabel: "gh", serverCmd: "y" });
  seedExchange(store, a, { id: "1", method: "tools/list", reqTs: 100, respTs: 150 });
  seedExchange(store, b, { id: "2", tool: "create_issue", reqTs: 200, respTs: 260, error: true });
  seedExchange(store, a, { id: "3", reqTs: 300 }); // pending, no response

  const timeline = store.getTimeline();

  expect(timeline.map((t) => t.jsonrpcId)).toEqual(["3", "2", "1"]);
  expect(timeline[0]).toMatchObject({ serverLabel: "fs", status: "pending", durationMs: null });
  expect(timeline[1]).toMatchObject({ serverLabel: "gh", status: "error", durationMs: 60 });
  expect(timeline[2]).toMatchObject({ serverLabel: "fs", client: "cursor", status: "ok", durationMs: 50 });
  store.close();
});

test("getTimeline filters by status", () => {
  const store = memStore();
  const s = store.startSession({ serverLabel: "fs", serverCmd: "x" });
  seedExchange(store, s, { id: "1", reqTs: 100, respTs: 150 });
  seedExchange(store, s, { id: "2", reqTs: 200, respTs: 250, error: true });

  const errors = store.getTimeline({ status: "error" });

  expect(errors).toHaveLength(1);
  expect(errors[0].jsonrpcId).toBe("2");
  store.close();
});

test("getCostSummary aggregates totals, per-tool, per-server and error count", () => {
  const store = memStore();
  const a = store.startSession({ serverLabel: "fs", serverCmd: "x" });
  const b = store.startSession({ serverLabel: "gh", serverCmd: "y" });
  seedExchange(store, a, { id: "1", tool: "read_file", reqTs: 100, respTs: 150, reqTok: 5, respTok: 20 });
  seedExchange(store, a, { id: "2", tool: "read_file", reqTs: 160, respTs: 170, reqTok: 3, respTok: 7 });
  seedExchange(store, b, { id: "3", tool: "create_issue", reqTs: 200, respTs: 260, error: true, reqTok: 4, respTok: 6 });

  const cost = store.getCostSummary();

  expect(cost.exchangeCount).toBe(3);
  expect(cost.errorCount).toBe(1);
  expect(cost.totalTokens).toBe(5 + 20 + 3 + 7 + 4 + 6);
  expect(cost.byTool).toContainEqual({ toolName: "read_file", calls: 2, tokens: 35 });
  expect(cost.byServer).toContainEqual({ serverLabel: "gh", calls: 1, tokens: 10 });
  store.close();
});
