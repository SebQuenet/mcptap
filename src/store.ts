import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import type { DatabaseSync as DatabaseSyncInstance } from "node:sqlite";
import type { MessageKind } from "./classify.js";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

export type Direction = "client_to_server" | "server_to_client";

export interface StartSessionInput {
  serverLabel: string;
  serverCmd: string;
  client?: string | null;
}

export interface RecordMessageInput {
  sessionId: string;
  direction: Direction;
  kind: MessageKind | "malformed";
  method: string | null;
  toolName: string | null;
  jsonrpcId: string | null;
  ts: number;
  payload: string;
  estTokens?: number | null;
  byteSize: number;
}

export interface ExchangeRow {
  requestMsgId: number;
  responseMsgId: number | null;
  sessionId: string;
  method: string | null;
  toolName: string | null;
  jsonrpcId: string;
  startedAt: number;
  durationMs: number | null;
  isError: boolean;
  reqTokens: number | null;
  respTokens: number | null;
}

export interface MessageRow {
  id: number;
  sessionId: string;
  direction: Direction;
  kind: string;
  method: string | null;
  toolName: string | null;
  jsonrpcId: string | null;
  ts: number;
  payload: string;
  estTokens: number | null;
  byteSize: number;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  server_label  TEXT NOT NULL,
  server_cmd    TEXT NOT NULL,
  client        TEXT,
  started_at    INTEGER NOT NULL,
  ended_at      INTEGER
);
CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT NOT NULL REFERENCES sessions(id),
  direction   TEXT NOT NULL,
  kind        TEXT NOT NULL,
  method      TEXT,
  tool_name   TEXT,
  jsonrpc_id  TEXT,
  ts          INTEGER NOT NULL,
  payload     TEXT NOT NULL,
  est_tokens  INTEGER,
  byte_size   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, ts);
CREATE TABLE IF NOT EXISTS exchanges (
  request_msg_id   INTEGER NOT NULL REFERENCES messages(id),
  response_msg_id  INTEGER REFERENCES messages(id),
  session_id       TEXT NOT NULL REFERENCES sessions(id),
  method           TEXT,
  tool_name        TEXT,
  jsonrpc_id       TEXT NOT NULL,
  started_at       INTEGER NOT NULL,
  duration_ms      INTEGER,
  is_error         INTEGER NOT NULL DEFAULT 0,
  req_tokens       INTEGER,
  resp_tokens      INTEGER,
  PRIMARY KEY (session_id, jsonrpc_id)
);
`;

export class Store {
  private db: DatabaseSyncInstance;

  constructor(dbPath: string) {
    this.db = new DatabaseSync(dbPath);
  }

  init(): void {
    this.db.exec(SCHEMA);
  }

  startSession(input: StartSessionInput): string {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO sessions (id, server_label, server_cmd, client, started_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(id, input.serverLabel, input.serverCmd, input.client ?? null, Date.now());
    return id;
  }

  endSession(sessionId: string, endedAt: number): void {
    this.db.prepare(`UPDATE sessions SET ended_at = ? WHERE id = ?`).run(endedAt, sessionId);
  }

  recordMessage(input: RecordMessageInput): number {
    const result = this.db
      .prepare(
        `INSERT INTO messages
           (session_id, direction, kind, method, tool_name, jsonrpc_id, ts, payload, est_tokens, byte_size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.sessionId,
        input.direction,
        input.kind,
        input.method,
        input.toolName,
        input.jsonrpcId,
        input.ts,
        input.payload,
        input.estTokens ?? null,
        input.byteSize,
      );
    const msgId = Number(result.lastInsertRowid);
    this.updateExchange(msgId, input);
    return msgId;
  }

  private updateExchange(msgId: number, input: RecordMessageInput): void {
    if (input.jsonrpcId === null) return; // notifications have no exchange

    if (input.kind === "request") {
      this.db
        .prepare(
          `INSERT INTO exchanges
             (request_msg_id, session_id, method, tool_name, jsonrpc_id, started_at, req_tokens)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          msgId,
          input.sessionId,
          input.method,
          input.toolName,
          input.jsonrpcId,
          input.ts,
          input.estTokens ?? null,
        );
      return;
    }

    if (input.kind === "response" || input.kind === "error") {
      const open = this.db
        .prepare(`SELECT started_at FROM exchanges WHERE session_id = ? AND jsonrpc_id = ?`)
        .get(input.sessionId, input.jsonrpcId) as { started_at: number } | undefined;
      if (!open) return; // orphan response: kept in messages only

      this.db
        .prepare(
          `UPDATE exchanges
             SET response_msg_id = ?, duration_ms = ?, is_error = ?, resp_tokens = ?
           WHERE session_id = ? AND jsonrpc_id = ?`,
        )
        .run(
          msgId,
          input.ts - open.started_at,
          input.kind === "error" ? 1 : 0,
          input.estTokens ?? null,
          input.sessionId,
          input.jsonrpcId,
        );
    }
  }

  getExchanges(sessionId: string): ExchangeRow[] {
    const rows = this.db
      .prepare(
        `SELECT request_msg_id, response_msg_id, session_id, method, tool_name, jsonrpc_id,
                started_at, duration_ms, is_error, req_tokens, resp_tokens
         FROM exchanges WHERE session_id = ? ORDER BY started_at, request_msg_id`,
      )
      .all(sessionId) as Record<string, unknown>[];
    return rows.map((r) => ({
      requestMsgId: r.request_msg_id as number,
      responseMsgId: (r.response_msg_id as number | null) ?? null,
      sessionId: r.session_id as string,
      method: (r.method as string | null) ?? null,
      toolName: (r.tool_name as string | null) ?? null,
      jsonrpcId: r.jsonrpc_id as string,
      startedAt: r.started_at as number,
      durationMs: (r.duration_ms as number | null) ?? null,
      isError: (r.is_error as number) === 1,
      reqTokens: (r.req_tokens as number | null) ?? null,
      respTokens: (r.resp_tokens as number | null) ?? null,
    }));
  }

  getMessages(sessionId: string): MessageRow[] {
    const rows = this.db
      .prepare(
        `SELECT id, session_id, direction, kind, method, tool_name, jsonrpc_id, ts, payload, est_tokens, byte_size
         FROM messages WHERE session_id = ? ORDER BY ts, id`,
      )
      .all(sessionId) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: r.id as number,
      sessionId: r.session_id as string,
      direction: r.direction as Direction,
      kind: r.kind as string,
      method: (r.method as string | null) ?? null,
      toolName: (r.tool_name as string | null) ?? null,
      jsonrpcId: (r.jsonrpc_id as string | null) ?? null,
      ts: r.ts as number,
      payload: r.payload as string,
      estTokens: (r.est_tokens as number | null) ?? null,
      byteSize: r.byte_size as number,
    }));
  }

  close(): void {
    this.db.close();
  }
}
