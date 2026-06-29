import { expect, test } from "vitest";
import { rewriteConfig, unwrapConfig } from "./init-config.js";

test("wraps a stdio server entry through the mcptap wrapper, preserving env", () => {
  const { config, changed } = rewriteConfig({
    mcpServers: {
      fs: { command: "node", args: ["server.js"], env: { TOKEN: "x" } },
    },
  });

  expect(changed).toEqual(["fs"]);
  expect(config.mcpServers.fs).toEqual({
    command: "mcptap",
    args: ["wrap", "--label", "fs", "--", "node", "server.js"],
    env: { TOKEN: "x" },
  });
});

test("wraps an entry that has no args", () => {
  const { config } = rewriteConfig({ mcpServers: { db: { command: "uvx" } } });

  expect(config.mcpServers.db).toMatchObject({
    command: "mcptap",
    args: ["wrap", "--label", "db", "--", "uvx"],
  });
});

test("leaves remote (url) server entries untouched", () => {
  const input = { mcpServers: { remote: { url: "https://example.com/mcp" } } };
  const { config, changed } = rewriteConfig(input);

  expect(changed).toEqual([]);
  expect(config.mcpServers.remote).toEqual({ url: "https://example.com/mcp" });
});

test("is idempotent: an already-wrapped entry is not rewrapped", () => {
  const once = rewriteConfig({ mcpServers: { fs: { command: "node", args: ["s.js"] } } });
  const twice = rewriteConfig(once.config);

  expect(twice.changed).toEqual([]);
  expect(twice.config.mcpServers.fs).toEqual(once.config.mcpServers.fs);
});

test("handles a config with no mcpServers", () => {
  const { config, changed } = rewriteConfig({});
  expect(changed).toEqual([]);
  expect(config).toEqual({ mcpServers: {} });
});

test("unwrapConfig restores a wrapped entry to its original command and args", () => {
  const original = { mcpServers: { fs: { command: "node", args: ["server.js"], env: { T: "1" } } } };
  const wrapped = rewriteConfig(original).config;

  const { config, changed } = unwrapConfig(wrapped);

  expect(changed).toEqual(["fs"]);
  expect(config.mcpServers.fs).toEqual({ command: "node", args: ["server.js"], env: { T: "1" } });
});
