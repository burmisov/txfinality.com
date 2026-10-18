// The runner. Sends n transfers one at a time: each is sent alone, watched until it reaches the
// chain's final level (or fails, or its cap passes), and only then is the next one built and sent.
// Nothing else happens while a transfer is in flight. It writes `runs/<chain>/<stamp>.json`.
//
// The clock for a transfer starts the instant before its bytes leave this machine. A level's time
// is the instant the poll that first showed it came back, so every figure includes up to one poll
// interval and one RPC round trip of slack: the number is never smaller than the truth. Durations
// come from the monotonic clock, to the millisecond.
import { mkdirSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import { type Chain, roleLevel } from "./chain.ts";
import type { Driver } from "./driver.ts";
import { root } from "./root.ts";

export const METHOD = "v0";

export type Transfer = {
  id: string;
  sent: string;
  /** seconds from `sent` to the first sight of each level, in the chain file's words, to the ms */
  levels: Record<string, number>;
  failed?: string;
  /** how many status polls it took; with pollMs, the slack this transfer's figures carry */
  polls: number;
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
  wallets: { from: string; to: string };
  /** transactions outside the clock: what setup created and what teardown undid */
  setup: string[];
  teardown: string[];
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
  /** per transfer: a transfer still short of final after this long is left where it is */
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

/** Polls `driver.status` for one transfer until it has reached the last level, failed, or
 *  `capMs` has passed since `from` (a `performance.now()` reading taken before sending). */
export async function watchOne(
  driver: Driver,
  t: Transfer,
  from: number,
  capMs: number,
  pollMs: number,
  log?: Options["log"],
): Promise<void> {
  const final = driver.levels[driver.levels.length - 1];
  if (final === undefined) throw new Error("driver has no levels");
  while (t.failed === undefined && t.levels[final] === undefined) {
    if (performance.now() - from > capMs) return;
    const statuses = await driver.status([t.id]);
    const now = performance.now();
    t.polls++;
    const s = statuses.get(t.id);
    if (s) {
      for (const level of reached(driver.levels, s.level)) {
        if (t.levels[level] === undefined) {
          t.levels[level] = Math.round(now - from) / 1000;
          say(log, `  ${level.padEnd(12)} ${t.levels[level]}s`);
        }
      }
      if (s.failed !== undefined) {
        t.failed = s.failed;
        say(log, `  failed on chain: ${s.failed}`);
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
  const setup = await driver.setup();
  for (const line of setup.lines) say(opts.log, line);

  const transfers: Transfer[] = [];
  say(opts.log, `${opts.runs} transfers of ${chain.asset.amount} ${chain.asset.symbol}, one at a time, each to final before the next`);
  let teardown: { lines: string[]; txs: string[] } = { lines: [], txs: [] };
  try {
    for (let i = 0; i < opts.runs; i++) {
      const signed = await driver.prepare(i, opts.runs, `${tag} ${i + 1}/${opts.runs}`);
      const t: Transfer = { id: signed.id, sent: "", levels: {}, polls: 0 };
      const from = performance.now();
      t.sent = new Date().toISOString();
      await driver.send(signed);
      say(opts.log, `${i + 1}/${opts.runs} ${signed.id}`);
      transfers.push(t);
      await watchOne(driver, t, from, opts.capMinutes * 60_000, opts.pollMs, opts.log);
    }
  } finally {
    // Whatever happened above, what setup created is undone and the asset goes back to the
    // sender. If this itself fails, `txfinality return` does the same thing by hand.
    teardown = await driver.teardown();
    for (const line of teardown.lines) say(opts.log, line);
  }

  return {
    chain: chain.id,
    method: METHOD,
    stamp,
    machine: opts.machine ?? hostname(),
    rpc: chain.rpc.provider || opts.rpc,
    asset: chain.asset.symbol,
    amount: chain.asset.amount,
    chainFile: chain.hash,
    wallets: driver.wallets,
    setup: setup.txs,
    teardown: teardown.txs,
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
