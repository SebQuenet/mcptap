import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { runInit } from "./init.js";

const dirs: string[] = [];

function tmpConfig(content: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "mcptap-"));
  dirs.push(dir);
  const path = join(dir, "config.json");
  writeFileSync(path, JSON.stringify(content, null, 2));
  return path;
}

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

test("processes existing configs and skips missing ones", () => {
  const path = tmpConfig({ mcpServers: { fs: { command: "node", args: ["s.js"] } } });
  const missing = join(dirname(path), "nope.json");

  const results = runInit([
    { client: "a", path },
    { client: "b", path: missing },
  ]);

  expect(results).toHaveLength(1);
  expect(results[0]).toMatchObject({ client: "a", changed: ["fs"], wrote: true });
  expect(readJson(path).mcpServers.fs.command).toBe("mcptap");
});

test("dry-run reports changes without writing", () => {
  const path = tmpConfig({ mcpServers: { fs: { command: "node", args: ["s.js"] } } });

  const results = runInit([{ client: "a", path }], { dryRun: true });

  expect(results[0]).toMatchObject({ changed: ["fs"], wrote: false });
  expect(readJson(path).mcpServers.fs.command).toBe("node");
});

test("revert restores wrapped configs", () => {
  const path = tmpConfig({ mcpServers: { fs: { command: "node", args: ["s.js"] } } });
  runInit([{ client: "a", path }]);

  const results = runInit([{ client: "a", path }], { revert: true });

  expect(results[0]).toMatchObject({ reverted: true });
  expect(readJson(path).mcpServers.fs.command).toBe("node");
});
