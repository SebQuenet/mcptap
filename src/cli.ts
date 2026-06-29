#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { parseArgs, type ParsedArgs } from "./cli-args.js";
import { knownConfigPaths } from "./config-paths.js";
import { runInit, type InitItemResult } from "./init.js";
import { Store } from "./store.js";
import { startWrapper } from "./wrapper.js";

function defaultDbPath(): string {
  return process.env.MCPTAP_DB ?? join(homedir(), ".mcptap", "mcptap.db");
}

async function runWrap(parsed: Extract<ParsedArgs, { cmd: "wrap" }>): Promise<void> {
  const dbPath = defaultDbPath();
  mkdirSync(dirname(dbPath), { recursive: true });
  const store = new Store(dbPath);
  store.init();

  const { exited } = startWrapper({
    command: parsed.command,
    args: parsed.args,
    label: parsed.label,
    store,
    clientIn: process.stdin,
    clientOut: process.stdout,
  });

  const code = await exited;
  store.close();
  process.exit(code);
}

function runInitCommand(parsed: Extract<ParsedArgs, { cmd: "init" }>): void {
  const candidates = knownConfigPaths({
    home: homedir(),
    platform: process.platform,
    cwd: process.cwd(),
  });
  const results = runInit(candidates, { dryRun: parsed.dryRun, revert: parsed.revert });
  printInitSummary(results, parsed);
}

function printInitSummary(results: InitItemResult[], parsed: Extract<ParsedArgs, { cmd: "init" }>): void {
  if (results.length === 0) {
    console.log("No MCP client config found in the known locations.");
    return;
  }
  for (const r of results) {
    if (parsed.revert) {
      console.log(`${r.reverted ? "reverted" : "unchanged"}  ${r.client}  ${r.path}`);
    } else {
      const verb = r.changed.length === 0 ? "no change" : parsed.dryRun ? "would wrap" : "wrapped";
      const names = r.changed.length ? ` [${r.changed.join(", ")}]` : "";
      console.log(`${verb}  ${r.client}  ${r.path}${names}`);
    }
  }
  if (parsed.dryRun) console.log("\n(dry run — no files were modified)");
}

function printHelp(): void {
  console.log(`mcptap — the DevTools network tab for MCP

Usage:
  mcptap init [--dry-run] [--revert]   route detected MCP clients through mcptap
  mcptap wrap --label <name> -- <cmd>  run a server under the wrapper (used by init)
  mcptap view [--port <n>]             open the local viewer        (coming soon)
  mcptap purge                         wipe the local capture DB     (coming soon)`);
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  switch (parsed.cmd) {
    case "wrap":
      await runWrap(parsed);
      return;
    case "init":
      runInitCommand(parsed);
      return;
    case "view":
      console.error("mcptap view: not implemented yet (M4).");
      process.exit(1);
      return;
    case "purge":
      console.error("mcptap purge: not implemented yet (M5).");
      process.exit(1);
      return;
    default:
      printHelp();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
