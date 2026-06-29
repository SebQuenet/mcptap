import { join } from "node:path";

export interface ConfigCandidate {
  client: string;
  path: string;
}

export interface PathEnv {
  home: string;
  platform: NodeJS.Platform;
  cwd: string;
}

function claudeDesktopPath(env: PathEnv): string {
  switch (env.platform) {
    case "darwin":
      return join(env.home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
    case "win32":
      return join(env.home, "AppData", "Roaming", "Claude", "claude_desktop_config.json");
    default:
      return join(env.home, ".config", "Claude", "claude_desktop_config.json");
  }
}

/**
 * Candidate MCP client config locations for the current environment.
 * Existence is not checked here; callers filter to the files that exist.
 */
export function knownConfigPaths(env: PathEnv): ConfigCandidate[] {
  return [
    { client: "claude-desktop", path: claudeDesktopPath(env) },
    { client: "cursor", path: join(env.home, ".cursor", "mcp.json") },
    { client: "windsurf", path: join(env.home, ".codeium", "windsurf", "mcp_config.json") },
    { client: "project", path: join(env.cwd, ".mcp.json") },
  ];
}
