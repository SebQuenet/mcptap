import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { applyToFile, revertFile } from "./init-file.js";

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

test("wraps the config file and backs up the original", () => {
  const path = tmpConfig({ mcpServers: { fs: { command: "node", args: ["s.js"] } } });

  const res = applyToFile(path);

  expect(res.changed).toEqual(["fs"]);
  expect(res.wrote).toBe(true);
  expect(readJson(path).mcpServers.fs.command).toBe("mcptap");
  expect(existsSync(`${path}.mcptap.bak`)).toBe(true);
  expect(readJson(`${path}.mcptap.bak`).mcpServers.fs.command).toBe("node");
});

test("dry-run reports changes without writing the file or a backup", () => {
  const path = tmpConfig({ mcpServers: { fs: { command: "node", args: ["s.js"] } } });

  const res = applyToFile(path, { dryRun: true });

  expect(res.changed).toEqual(["fs"]);
  expect(res.wrote).toBe(false);
  expect(readJson(path).mcpServers.fs.command).toBe("node");
  expect(existsSync(`${path}.mcptap.bak`)).toBe(false);
});

test("revert restores the original from backup and removes the backup", () => {
  const path = tmpConfig({ mcpServers: { fs: { command: "node", args: ["s.js"] } } });
  applyToFile(path);

  const res = revertFile(path);

  expect(res.reverted).toBe(true);
  expect(readJson(path).mcpServers.fs.command).toBe("node");
  expect(existsSync(`${path}.mcptap.bak`)).toBe(false);
});

test("applying twice keeps the pristine original in the backup", () => {
  const path = tmpConfig({ mcpServers: { fs: { command: "node", args: ["s.js"] } } });

  applyToFile(path);
  const second = applyToFile(path);

  expect(second.changed).toEqual([]);
  expect(second.wrote).toBe(false);
  expect(readJson(`${path}.mcptap.bak`).mcpServers.fs.command).toBe("node");
});
