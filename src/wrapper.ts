import { spawn } from "node:child_process";
import type { Readable, Writable } from "node:stream";
import { classifyMessage } from "./classify.js";
import { FrameParser, type Frame } from "./frame-parser.js";
import type { Direction, Store } from "./store.js";
import { estimateTokens } from "./tokens.js";

export interface StartWrapperOptions {
  command: string;
  args: string[];
  label: string;
  store: Store;
  clientIn: Readable;
  clientOut: Writable;
  client?: string | null;
}

export interface WrapperHandle {
  sessionId: string;
  exited: Promise<number>;
}

export function startWrapper(opts: StartWrapperOptions): WrapperHandle {
  const { command, args, label, store, clientIn, clientOut } = opts;

  const sessionId = store.startSession({
    serverLabel: label,
    serverCmd: [command, ...args].join(" "),
    client: opts.client ?? null,
  });

  const child = spawn(command, args, { stdio: ["pipe", "pipe", "inherit"] });

  const record = (frame: Frame, direction: Direction): void => {
    try {
      const byteSize = Buffer.byteLength(frame.raw, "utf8");
      const estTokens = estimateTokens(frame.raw);
      if (frame.kind === "malformed") {
        store.recordMessage({
          sessionId,
          direction,
          kind: "malformed",
          method: null,
          toolName: null,
          jsonrpcId: null,
          ts: Date.now(),
          payload: frame.raw,
          estTokens,
          byteSize,
        });
        return;
      }
      const c = classifyMessage(frame.message);
      store.recordMessage({
        sessionId,
        direction,
        kind: c.kind,
        method: c.method,
        toolName: c.toolName,
        jsonrpcId: c.jsonrpcId,
        ts: Date.now(),
        payload: frame.raw,
        estTokens,
        byteSize,
      });
    } catch {
      // Capture is best-effort: never let a recording failure break the proxied stream.
    }
  };

  const clientParser = new FrameParser();
  clientIn.on("data", (chunk: Buffer) => {
    child.stdin?.write(chunk); // forward raw bytes, untouched
    for (const frame of clientParser.push(chunk.toString("utf8"))) {
      record(frame, "client_to_server");
    }
  });
  clientIn.on("end", () => child.stdin?.end());

  const serverParser = new FrameParser();
  child.stdout?.on("data", (chunk: Buffer) => {
    clientOut.write(chunk); // forward raw bytes, untouched
    for (const frame of serverParser.push(chunk.toString("utf8"))) {
      record(frame, "server_to_client");
    }
  });

  const exited = new Promise<number>((resolve) => {
    child.on("exit", (code) => {
      store.endSession(sessionId, Date.now());
      resolve(code ?? 0);
    });
  });

  return { sessionId, exited };
}
