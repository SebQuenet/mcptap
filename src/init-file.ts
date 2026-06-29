import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { rewriteConfig, unwrapConfig } from "./init-config.js";

const BACKUP_SUFFIX = ".mcptap.bak";

export interface ApplyResult {
  changed: string[];
  wrote: boolean;
  backupPath?: string;
}

export interface RevertResult {
  reverted: boolean;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

/**
 * Route a client config file's stdio servers through the mcptap wrapper.
 * Backs the pristine original up to `<path>.mcptap.bak` before the first write.
 * With `dryRun`, reports what would change without touching disk.
 */
export function applyToFile(path: string, opts: { dryRun?: boolean } = {}): ApplyResult {
  const { config, changed } = rewriteConfig(readJson(path));
  if (changed.length === 0) return { changed, wrote: false };
  if (opts.dryRun) return { changed, wrote: false };

  const backupPath = `${path}${BACKUP_SUFFIX}`;
  if (!existsSync(backupPath)) copyFileSync(path, backupPath);
  writeJson(path, config);
  return { changed, wrote: true, backupPath };
}

/**
 * Undo `applyToFile`: restore the pristine backup if present, otherwise fall
 * back to unwrapping the wrapped entries in place.
 */
export function revertFile(path: string): RevertResult {
  const backupPath = `${path}${BACKUP_SUFFIX}`;
  if (existsSync(backupPath)) {
    copyFileSync(backupPath, path);
    rmSync(backupPath);
    return { reverted: true };
  }

  const { config, changed } = unwrapConfig(readJson(path));
  if (changed.length === 0) return { reverted: false };
  writeJson(path, config);
  return { reverted: true };
}
