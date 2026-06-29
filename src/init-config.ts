export type ServerEntry = Record<string, unknown>;

export interface ClientConfig {
  mcpServers: Record<string, ServerEntry>;
  [key: string]: unknown;
}

export interface RewriteResult {
  config: ClientConfig;
  changed: string[];
}

const WRAP_COMMAND = "mcptap";

function asConfig(input: unknown): ClientConfig {
  const obj = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const servers =
    typeof obj.mcpServers === "object" && obj.mcpServers !== null
      ? (obj.mcpServers as Record<string, ServerEntry>)
      : {};
  return { ...obj, mcpServers: servers };
}

/**
 * Rewrite each stdio server entry so the client launches `mcptap wrap -- <cmd>`
 * instead of the server directly. Remote (url) entries and already-wrapped
 * entries are left untouched; the operation is idempotent.
 */
export function rewriteConfig(input: unknown): RewriteResult {
  const config = asConfig(input);
  const servers: Record<string, ServerEntry> = {};
  const changed: string[] = [];

  for (const [name, entry] of Object.entries(config.mcpServers)) {
    const command = entry.command;
    if (typeof command === "string" && command !== WRAP_COMMAND) {
      const args = Array.isArray(entry.args) ? (entry.args as string[]) : [];
      servers[name] = {
        ...entry,
        command: WRAP_COMMAND,
        args: ["wrap", "--label", name, "--", command, ...args],
      };
      changed.push(name);
    } else {
      servers[name] = entry;
    }
  }

  return { config: { ...config, mcpServers: servers }, changed };
}

/** Inverse of rewriteConfig: restore wrapped entries to their original command/args. */
export function unwrapConfig(input: unknown): RewriteResult {
  const config = asConfig(input);
  const servers: Record<string, ServerEntry> = {};
  const changed: string[] = [];

  for (const [name, entry] of Object.entries(config.mcpServers)) {
    const args = entry.args;
    if (entry.command === WRAP_COMMAND && Array.isArray(args) && args.includes("--")) {
      const sep = args.indexOf("--");
      const originalCommand = args[sep + 1] as string;
      const originalArgs = args.slice(sep + 2) as string[];
      const restored: ServerEntry = { ...entry, command: originalCommand };
      if (originalArgs.length > 0) {
        restored.args = originalArgs;
      } else {
        delete restored.args;
      }
      servers[name] = restored;
      changed.push(name);
    } else {
      servers[name] = entry;
    }
  }

  return { config: { ...config, mcpServers: servers }, changed };
}
