import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { Store } from "./store.js";
import { startWrapper } from "./wrapper.js";

const fixture = (name: string) =>
  fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url));

async function waitFor(cond: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor timed out");
    await new Promise((r) => setTimeout(r, 10));
  }
}

test("passes traffic through byte-faithfully and records both directions", async () => {
  const store = new Store(":memory:");
  store.init();

  const clientIn = new PassThrough();
  const clientOut = new PassThrough();
  const outChunks: Buffer[] = [];
  clientOut.on("data", (c) => outChunks.push(Buffer.from(c)));

  const { sessionId, exited } = startWrapper({
    command: process.execPath,
    args: [fixture("echo-server.mjs")],
    label: "echo",
    store,
    clientIn,
    clientOut,
  });

  clientIn.write('{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n');
  await waitFor(() => outChunks.length > 0);
  clientIn.end();
  await exited;

  // Passthrough fidelity: client sees exactly what the server emitted.
  const out = Buffer.concat(outChunks).toString("utf8");
  expect(out).toBe('{"jsonrpc":"2.0","id":1,"result":{"echoed":"tools/list"}}\n');

  // Capture: both frames recorded, classified, attributed to the right direction.
  const msgs = store.getMessages(sessionId);
  expect(msgs).toHaveLength(2);
  expect(msgs[0]).toMatchObject({
    direction: "client_to_server",
    kind: "request",
    method: "tools/list",
    jsonrpcId: "1",
    payload: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}',
  });
  expect(msgs[1]).toMatchObject({
    direction: "server_to_client",
    kind: "response",
    jsonrpcId: "1",
    payload: '{"jsonrpc":"2.0","id":1,"result":{"echoed":"tools/list"}}',
  });

  store.close();
});

test("pairs the round-trip into an exchange with estimated tokens and a duration", async () => {
  const store = new Store(":memory:");
  store.init();

  const clientIn = new PassThrough();
  const clientOut = new PassThrough();
  let sawResponse = false;
  clientOut.on("data", () => (sawResponse = true));

  const { sessionId, exited } = startWrapper({
    command: process.execPath,
    args: [fixture("echo-server.mjs")],
    label: "echo",
    store,
    clientIn,
    clientOut,
  });

  clientIn.write('{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n');
  await waitFor(() => sawResponse);
  clientIn.end();
  await exited;

  const exchanges = store.getExchanges(sessionId);
  expect(exchanges).toHaveLength(1);
  expect(exchanges[0]).toMatchObject({
    jsonrpcId: "1",
    method: "tools/list",
    isError: false,
  });
  expect(exchanges[0].reqTokens).toBeGreaterThan(0);
  expect(exchanges[0].respTokens).toBeGreaterThan(0);
  expect(exchanges[0].durationMs).toBeGreaterThanOrEqual(0);

  store.close();
});
