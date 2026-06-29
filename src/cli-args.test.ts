import { expect, test } from "vitest";
import { parseArgs } from "./cli-args.js";

test("parses a wrap command with label and the wrapped command after --", () => {
  expect(parseArgs(["wrap", "--label", "fs", "--", "node", "server.js", "--flag"])).toEqual({
    cmd: "wrap",
    label: "fs",
    command: "node",
    args: ["server.js", "--flag"],
  });
});

test("defaults the wrap label to the wrapped command when --label is omitted", () => {
  expect(parseArgs(["wrap", "--", "uvx"])).toMatchObject({
    cmd: "wrap",
    label: "uvx",
    command: "uvx",
    args: [],
  });
});

test("parses init with no flags", () => {
  expect(parseArgs(["init"])).toEqual({ cmd: "init", dryRun: false, revert: false });
});

test("parses init with --dry-run and --revert", () => {
  expect(parseArgs(["init", "--dry-run", "--revert"])).toEqual({
    cmd: "init",
    dryRun: true,
    revert: true,
  });
});

test("returns a help command for empty or unknown input", () => {
  expect(parseArgs([])).toEqual({ cmd: "help" });
  expect(parseArgs(["nonsense"])).toEqual({ cmd: "help" });
});
