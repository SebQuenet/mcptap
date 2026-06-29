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
    return Number(result.lastInsertRowid);
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
