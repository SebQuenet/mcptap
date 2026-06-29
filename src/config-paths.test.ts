import { expect, test } from "vitest";
import { knownConfigPaths } from "./config-paths.js";

test("includes the macOS Claude Desktop path on darwin", () => {
  const paths = knownConfigPaths({ home: "/Users/seb", platform: "darwin", cwd: "/proj" });
  expect(paths).toContainEqual({
    client: "claude-desktop",
    path: "/Users/seb/Library/Application Support/Claude/claude_desktop_config.json",
  });
});

test("includes the Linux Claude Desktop path under ~/.config on linux", () => {
  const paths = knownConfigPaths({ home: "/home/seb", platform: "linux", cwd: "/proj" });
  expect(paths).toContainEqual({
    client: "claude-desktop",
    path: "/home/seb/.config/Claude/claude_desktop_config.json",
  });
});

test("includes the Cursor config under the home directory", () => {
  const paths = knownConfigPaths({ home: "/home/seb", platform: "linux", cwd: "/proj" });
  expect(paths).toContainEqual({ client: "cursor", path: "/home/seb/.cursor/mcp.json" });
});

test("always includes the project-level .mcp.json in the cwd", () => {
  const paths = knownConfigPaths({ home: "/home/seb", platform: "linux", cwd: "/proj" });
  expect(paths).toContainEqual({ client: "project", path: "/proj/.mcp.json" });
});
