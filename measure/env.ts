// Keys and RPC URLs come from the environment: the repository's ignored `.env` first, then
// `~/.config/txfinality/.env`. A variable already set in the shell wins over both files.
// Nothing here is ever printed; the only thing the runner shows of an RPC URL is its host name.
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { root } from "./root.ts";

let loaded = false;

export function loadEnv(): string[] {
  if (loaded) return [];
  loaded = true;
  const files = [join(root, ".env"), join(homedir(), ".config", "txfinality", ".env")];
  const used: string[] = [];
  for (const file of files) {
    if (!existsSync(file)) continue;
    process.loadEnvFile(file); // does not override variables that are already set
    used.push(file);
  }
  return used;
}

export class MissingVariable extends Error {
  readonly variable: string;
  constructor(variable: string) {
    super(`${variable} is not set; put it in .env (see .env.example)`);
    this.variable = variable;
  }
}

export function need(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") throw new MissingVariable(name);
  return value;
}

export function maybe(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value === "" ? undefined : value;
}

/** The part of an RPC URL that is safe to show: its host. Keys travel in paths and queries. */
export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "(not a URL)";
  }
}

/**
 * An RPC library's error quotes the URL it called, key and all, and so does the message of a failed
 * return that a run file records. Only the host of any `*_URL` variable survives here; use it on
 * every error that reaches a log, a run file or the terminal.
 */
export function redacted(e: unknown, env: NodeJS.ProcessEnv = process.env): string {
  let text = e instanceof Error ? `${e.stack ?? e.message}${"cause" in e && e.cause ? `\n  cause: ${String((e.cause as Error).message ?? e.cause)}` : ""}` : String(e);
  for (const [name, value] of Object.entries(env)) {
    if (name.endsWith("_URL") && value && value.length > 12) text = text.split(value).join(`${hostOf(value)}/…`);
  }
  return text;
}
