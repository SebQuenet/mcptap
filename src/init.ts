import { existsSync } from "node:fs";
import type { ConfigCandidate } from "./config-paths.js";
import { applyToFile, revertFile } from "./init-file.js";

export interface InitItemResult {
  client: string;
  path: string;
  changed: string[];
  wrote: boolean;
  reverted: boolean;
}

export interface InitOptions {
  dryRun?: boolean;
  revert?: boolean;
}

/** Apply (or revert) mcptap wrapping across the candidate configs that exist on disk. */
export function runInit(candidates: ConfigCandidate[], opts: InitOptions = {}): InitItemResult[] {
  const results: InitItemResult[] = [];

  for (const { client, path } of candidates) {
    if (!existsSync(path)) continue;

    if (opts.revert) {
      const { reverted } = revertFile(path);
      results.push({ client, path, changed: [], wrote: false, reverted });
    } else {
      const { changed, wrote } = applyToFile(path, { dryRun: opts.dryRun });
      results.push({ client, path, changed, wrote, reverted: false });
    }
  }

  return results;
}
