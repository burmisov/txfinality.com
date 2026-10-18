// The runner. Sends n transfers one per second, polls them together until every one has reached
// the chain's final level or the cap is hit, and writes `runs/<chain>/<stamp>.json`.
//
// The clock for a transfer starts the instant before its bytes leave this machine. A level's time
// is the instant the poll that first showed it came back, so every figure includes one poll
// interval and one RPC round trip of slack: the number is never smaller than the truth.
import { mkdirSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";

import { type Chain, roleLevel } from "./chain.ts";
import type { Driver } from "./driver.ts";
import { root } from "./root.ts";

export const METHOD = "v0";

export type Transfer = {
  id: string;
  sent: string;
  /** seconds from `sent` to the first sight of each level, in the chain file's words */
  levels: Record<string, number>;
  failed?: string;
};

export type Run = {
  chain: string;
  method: string;
  stamp: string;
  machine: string;
  rpc: string;
  asset: string;
  amount: string;
  chainFile: string;
  runs: number;
  pollMs: number;
  capMinutes: number;
  transfers: Transfer[];
  slowest: { done: number | null; final: number | null };
  notReached: { id: string; level: string }[];
};

export type Options = {
  runs: number;
  pollMs: number;
  capMinutes: number;
  machine?: string;
  /** host of the RPC endpoint, for the record; never the URL */
  rpc: string;
  log?: (line: string) => void;
};

const say = (log: Options["log"], line: string): void => (log ?? console.log)(line);

/** The levels at or below `level`, in order: a chain that reports "finalized" has passed "confirmed". */
export function reached(levels: readonly string[], level: string | null): string[] {
  if (level === null) return [];
  const at = levels.indexOf(level);
  return at < 0 ? [] : levels.slice(0, at + 1);
}

/** The slowest figure for `level` across transfers, or null if any transfer lacks it. */
export function slowest(transfers: readonly Transfer[], level: string): number | null {
  let max: number | null = null;
  for (const t of transfers) {
    const s = t.levels[level];
    if (s === undefined) return null;
    if (max === null || s > max) max = s;
  }
  return max;
}

export function notReached(
  transfers: readonly Transfer[],
  levels: readonly string[],
): { id: string; level: string }[] {
  const out: { id: string; level: string }[] = [];
  for (const t of transfers) {
    for (const level of levels) {
      if (t.levels[level] === undefined) {
        out.push({ id: t.id, level });
        break;
      }
    }
  }
  return out;
}

export function stampOf(d: Date): string {
  return d.toISOString().replace(/:(\d\d):\d\d\.\d+Z$/, "$1Z").replace(":", "");
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Polls `driver.status` for the transfers in `transfers` until each has reached the last level,
 *  failed, or `deadline` passes. New transfers may be pushed while it runs. */
export async function watchLevels(
  driver: Driver,
  transfers: Transfer[],
  sentAt: Map<string, number>,
  deadline: number,
  pollMs: number,
  sending: () => boolean,
  log?: Options["log"],
): Promise<void> {
  const final = driver.levels[driver.levels.length - 1];
  if (final === undefined) throw new Error("driver has no levels");
  const over = (t: Transfer): boolean => t.failed !== undefined || t.levels[final] !== undefined;
  for (;;) {
    const open = transfers.filter((t) => !over(t));
    if (open.length === 0 && !sending()) return;
    if (Date.now() > deadline) return;
    if (open.length > 0) {
      const statuses = await driver.status(open.map((t) => t.id));
      const now = Date.now();
      for (const t of open) {
        const s = statuses.get(t.id);
        if (!s) continue;
        const from = sentAt.get(t.id);
        if (from === undefined) continue;
        for (const level of reached(driver.levels, s.level)) {
          if (t.levels[level] === undefined) {
            t.levels[level] = Math.round((now - from) / 10) / 100;
            say(log, `  ${t.id.slice(0, 8)}… ${level} ${t.levels[level]}s`);
          }
        }
        if (s.failed !== undefined && t.failed === undefined) {
          t.failed = s.failed;
          say(log, `  ${t.id.slice(0, 8)}… failed on chain: ${s.failed}`);
        }
      }
    }
    await sleep(pollMs);
  }
}

export async function measure(chain: Chain, driver: Driver, opts: Options): Promise<Run> {
  if (driver.levels.join() !== chain.levels.map((l) => l.name).join()) {
    throw new Error(`driver levels [${driver.levels}] differ from chains/${chain.id}.yaml`);
  }
  const started = new Date();
  const stamp = stampOf(started);
  const tag = `txfinality ${chain.id} ${stamp}`;
  for (const line of await driver.setup()) say(opts.log, line);

  const transfers: Transfer[] = [];
  const sentAt = new Map<string, number>();
  let sending = true;
  const deadline = started.getTime() + opts.capMinutes * 60_000;
  const watching = watchLevels(driver, transfers, sentAt, deadline, opts.pollMs, () => sending, opts.log);

  say(opts.log, `sending ${opts.runs} transfers of ${chain.asset.amount} ${chain.asset.symbol}, one per second`);
  for (let i = 0; i < opts.runs; i++) {
    const signed = await driver.prepare(i, opts.runs, `${tag} ${i + 1}/${opts.runs}`);
    const at = Date.now();
    sentAt.set(signed.id, at);
    transfers.push({ id: signed.id, sent: new Date(at).toISOString(), levels: {} });
    await driver.send(signed);
    say(opts.log, `  ${i + 1}/${opts.runs} ${signed.id}`);
    const rest = at + 1000 - Date.now();
    if (rest > 0 && i + 1 < opts.runs) await sleep(rest);
  }
  sending = false;
  await watching;

  const run: Run = {
    chain: chain.id,
    method: METHOD,
    stamp,
    machine: opts.machine ?? hostname(),
    rpc: chain.rpc.provider || opts.rpc,
    asset: chain.asset.symbol,
    amount: chain.asset.amount,
    chainFile: chain.hash,
    runs: opts.runs,
    pollMs: opts.pollMs,
    capMinutes: opts.capMinutes,
    transfers,
    slowest: {
      done: slowest(transfers, roleLevel(chain, "done")),
      final: slowest(transfers, roleLevel(chain, "final")),
    },
    notReached: notReached(transfers, driver.levels),
  };
  return run;
}

export function writeRun(run: Run): string {
  const dir = join(root, "runs", run.chain);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${run.stamp}.json`);
  writeFileSync(file, `${JSON.stringify(run, null, 2)}\n`);
  return file;
}

export function summary(run: Run, chain: Chain): string[] {
  const final = roleLevel(chain, "final");
  const done = roleLevel(chain, "done");
  const ok = run.transfers.filter((t) => t.levels[final] !== undefined).length;
  const lines = [`${ok === run.runs ? "✓" : "✗"} ${ok} of ${run.runs} transfers reached ${final}`];
  lines.push(`slowest ${done}: ${run.slowest.done ?? "?"}s · slowest ${final}: ${run.slowest.final ?? "?"}s`);
  for (const level of chain.levels) {
    const s = slowest(run.transfers, level.name);
    lines.push(`  ${level.name.padEnd(12)} slowest ${s ?? "?"}s`);
  }
  if (run.notReached.length) {
    lines.push(`not reached: ${run.notReached.map((n) => `${n.id.slice(0, 8)}… ${n.level}`).join(", ")}`);
  }
  const failed = run.transfers.filter((t) => t.failed !== undefined).length;
  if (failed) lines.push(`failed on chain: ${failed}`);
  return lines;
}
