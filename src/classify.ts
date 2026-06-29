export type MessageKind = "request" | "response" | "notification" | "error";

export interface Classification {
  kind: MessageKind;
  method: string | null;
  jsonrpcId: string | null;
  toolName: string | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

export function classifyMessage(message: unknown): Classification {
  const msg = asRecord(message);
  const hasId = "id" in msg && msg.id !== null;
  const jsonrpcId = hasId ? String(msg.id) : null;
  const method = typeof msg.method === "string" ? msg.method : null;

  let kind: MessageKind;
  if (method !== null) {
    kind = hasId ? "request" : "notification";
  } else if ("error" in msg) {
    kind = "error";
  } else {
    kind = "response";
  }

  let toolName: string | null = null;
  if (method === "tools/call") {
    const params = asRecord(msg.params);
    if (typeof params.name === "string") toolName = params.name;
  }

  return { kind, method, jsonrpcId, toolName };
}
