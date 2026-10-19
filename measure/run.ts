// The runner. Sends n transfers one at a time: each is sent alone and watched. On a chain whose
// final level is quick, the next transfer is built only once the previous one is final (or failed,
// or capped). On a chain whose final level is documented at a minute or more — a rollup's L1
// finality — the next goes out once the previous has reached its *done* level, so the quick phase
// of each transfer still happens alone while the long waits overlap; a run then takes one L1
// finality plus twenty done-times rather than twenty L1 finalities. It writes
// `runs/<chain>/<stamp>.json`.
//
// The clock for a transfer starts the instant before its bytes leave this machine. A level's time
// is the instant the poll that first showed it came back, so every figure includes up to one poll
// interval and one RPC round trip of slack: the number is never smaller than the truth. Durations
// come from the monotonic clock, to the millisecond.
//
// Polling is fast (100 ms by default) while the next level is one the chain's docs put under a
// minute. Once the only levels left are ones documented at a minute or more — a rollup's batch on
// L1, say — the poll slows to `slowPollMs` (2 s by default): a figure of twenty minutes carries two
// seconds of slack, which is a tenth of a percent, and the RPC is spared a hundred thousand calls.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import { type Chain, roleLevel } from "./chain.ts";
import type { Driver, Signed } from "./driver.ts";
import { redacted } from "./env.ts";
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
  /** how many times the same signed bytes were sent again because no level had seen them yet */
  resent?: number;
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
  /** set when the return of funds failed: the measurements stand, `txfinality return` finishes the job */
  teardownError?: string;
  runs: number;
  pollMs: number;
  /** the poll interval once only slow levels remain, and which levels those are (none: never slowed) */
  slowPollMs: number;
  slowLevels: string[];
  /** the level after which the next transfer was sent while this one went on (method rule k); null = each to final */
  overlapAfter: string | null;
  capMinutes: number;
  transfers: Transfer[];
  slowest: { done: number | null; final: number | null };
  notReached: { id: string; level: string }[];
};

export type Options = {
  runs: number;
  pollMs: number;
  /** levels documented at a minute or more; polled at `slowPollMs` once every faster level is seen */
  slow?: readonly string[];
  slowPollMs?: number;
  resendMs?: number;
  /** called after each transfer with the run so far, so a long run leaves a trace if the process dies */
  progress?: (transfers: readonly Transfer[]) => void;
  /** keep `runs/<chain>/<stamp>.partial.json` up to date while the run goes (the CLI does) */
  partial?: boolean;
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

export const SLOW_POLL_MS = 2000;
/** A transfer no level has seen after this long is sent again, unchanged: an RPC can accept bytes
 *  and lose them (seen on BNB Chain, 2026-10-19: accepted, never pending, never mined). The clock
 *  is not touched, so a resend shows up in the figure, and `resent` says it happened. */
export const RESEND_MS = 20_000;

/** Rule k: on a chain whose final level is slow, the next transfer goes out once the previous one has
 *  reached `done`; otherwise only once it is over. Returns the gate level, or null for strictly serial. */
export function overlapAfter(levels: readonly string[], done: string, slow: readonly string[]): string | null {
  const final = levels[levels.length - 1];
  return final !== undefined && final !== done && slow.includes(final) ? done : null;
}

/** The poll interval for the next unreached level: `slow.ms` if that level is one of `slow.levels`. */
export function pollFor(levels: readonly string[], t: Transfer, fast: number, slow?: { ms: number; levels: readonly string[] }): number {
  if (!slow) return fast;
  const next = levels.find((l) => t.levels[l] === undefined);
  return next !== undefined && slow.levels.includes(next) ? Math.max(fast, slow.ms) : fast;
}

/** Polls `driver.status` for one transfer until it has reached the last level, failed, or
 *  `capMs` has passed since `from` (a `performance.now()` reading taken before sending). */
export async function watchOne(
  driver: Driver,
  t: Transfer,
  from: number,
  capMs: number,
  pollMs: number,
  log?: Options["log"],
  slow?: { ms: number; levels: readonly string[] },
  resend?: { signed: Signed; everyMs: number },
): Promise<void> {
  const final = driver.levels[driver.levels.length - 1];
  if (final === undefined) throw new Error("driver has no levels");
  let lastSent = from;
  while (t.failed === undefined && t.levels[final] === undefined) {
    if (performance.now() - from > capMs) return;
    if (resend && Object.keys(t.levels).length === 0 && performance.now() - lastSent > resend.everyMs) {
      await driver.send(resend.signed);
      lastSent = performance.now();
      t.resent = (t.resent ?? 0) + 1;
      say(log, `  not seen yet; sent again (${t.resent})`);
    }
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
    await sleep(pollFor(driver.levels, t, pollMs, slow));
  }
}

type InFlight = { t: Transfer; from: number; signed: Signed; lastSent: number };

/** Sends the run's transfers and watches them until each is over (final, failed, or capped). With a
 *  `gate` level, the next transfer is sent as soon as the previous one has reached it; without one,
 *  only once the previous one is over. Every poll asks the driver about all transfers in flight at
 *  once; a transfer's clock is its own, so what else is in flight does not move its figures. */
async function sendAndWatch(
  driver: Driver,
  transfers: Transfer[],
  opts: Options,
  run: { tag: string; gate: string | null; slow: { ms: number; levels: readonly string[] }; stamp: string; chainId: string },
): Promise<void> {
  const final = driver.levels[driver.levels.length - 1];
  if (final === undefined) throw new Error("driver has no levels");
  const capMs = opts.capMinutes * 60_000;
  const everyMs = opts.resendMs ?? RESEND_MS;
  const over = (a: InFlight): boolean => a.t.failed !== undefined || a.t.levels[final] !== undefined || performance.now() - a.from > capMs;
  const inFlight: InFlight[] = [];
  let i = 0;
  while (i < opts.runs || inFlight.length > 0) {
    const last = inFlight[inFlight.length - 1];
    if (i < opts.runs && (last === undefined || over(last) || (run.gate !== null && last.t.levels[run.gate] !== undefined))) {
      const signed = await driver.prepare(i, opts.runs, `${run.tag} ${i + 1}/${opts.runs}`);
      const t: Transfer = { id: signed.id, sent: "", levels: {}, polls: 0 };
      const from = performance.now();
      t.sent = new Date().toISOString();
      await driver.send(signed);
      say(opts.log, `${i + 1}/${opts.runs} ${signed.id}`);
      transfers.push(t);
      inFlight.push({ t, from, signed, lastSent: from });
      i++;
      continue;
    }
    for (const a of inFlight) {
      if (Object.keys(a.t.levels).length === 0 && performance.now() - a.lastSent > everyMs) {
        await driver.send(a.signed);
        a.lastSent = performance.now();
        a.t.resent = (a.t.resent ?? 0) + 1;
        say(opts.log, `  ${a.t.id.slice(0, 10)}… not seen yet; sent again (${a.t.resent})`);
      }
    }
    const statuses = await driver.status(inFlight.map((a) => a.t.id));
    const now = performance.now();
    for (const a of inFlight) {
      a.t.polls++;
      const s = statuses.get(a.t.id);
      if (!s) continue;
      for (const level of reached(driver.levels, s.level)) {
        if (a.t.levels[level] === undefined) {
          a.t.levels[level] = Math.round(now - a.from) / 1000;
          say(opts.log, `  ${inFlight.length > 1 ? `${a.t.id.slice(0, 10)}… ` : ""}${level.padEnd(12)} ${a.t.levels[level]}s`);
        }
      }
      if (s.failed !== undefined) {
        a.t.failed = s.failed;
        say(opts.log, `  failed on chain: ${s.failed}`);
      }
    }
    let retired = false;
    for (let k = inFlight.length - 1; k >= 0; k--) {
      const a = inFlight[k];
      if (a && over(a)) {
        inFlight.splice(k, 1);
        retired = true;
      }
    }
    if (retired) {
      opts.progress?.(transfers);
      if (opts.partial) writePartial(run.chainId, run.stamp, transfers);
    }
    if (inFlight.length > 0 && !(i < opts.runs && run.gate !== null && inFlight[inFlight.length - 1]?.t.levels[run.gate] !== undefined)) {
      await sleep(Math.min(...inFlight.map((a) => pollFor(driver.levels, a.t, opts.pollMs, run.slow))));
    }
  }
}

export async function measure(chain: Chain, driver: Driver, opts: Options): Promise<Run> {
  if (driver.levels.join() !== chain.levels.map((l) => l.name).join()) {
    throw new Error(`driver levels [${driver.levels}] differ from chains/${chain.id}.yaml`);
  }
  const started = new Date();
  const stamp = stampOf(started);
  const slow = { ms: opts.slowPollMs ?? SLOW_POLL_MS, levels: opts.slow ?? [] };
  const tag = `txfinality ${chain.id} ${stamp}`;
  const setup = await driver.setup();
  for (const line of setup.lines) say(opts.log, line);

  const transfers: Transfer[] = [];
  const gate = overlapAfter(driver.levels, roleLevel(chain, "done"), slow.levels);
  say(
    opts.log,
    `${opts.runs} transfers of ${chain.asset.amount} ${chain.asset.symbol}, one at a time, ${gate === null ? "each to final before the next" : `the next once the previous is ${gate}`}`,
  );
  let teardown: { lines: string[]; txs: string[] } = { lines: [], txs: [] };
  let teardownError: string | undefined;
  try {
    await sendAndWatch(driver, transfers, opts, { tag, gate, slow, stamp, chainId: chain.id });
  } finally {
    // Whatever happened above, what setup created is undone and the asset goes back to the
    // sender. If this itself fails, the measurements are still written and `txfinality return`
    // does the same thing by hand.
    try {
      teardown = await driver.teardown();
      for (const line of teardown.lines) say(opts.log, line);
    } catch (e) {
      // the message is what the run file keeps, and a library quotes its URL in it: host only
      teardownError = redacted(e instanceof Error ? e.message : e);
      say(opts.log, `the return of funds failed (run \`txfinality return --chain ${chain.id}\`): ${teardownError}`);
    }
  }

  return {
    chain: chain.id,
    method: METHOD,
    stamp,
    machine: opts.machine ?? "runner", // a label, never a host name or a place: the run file is public
    rpc: chain.rpc.provider || opts.rpc,
    asset: chain.asset.symbol,
    amount: chain.asset.amount,
    chainFile: chain.hash,
    wallets: driver.wallets,
    setup: setup.txs,
    teardown: teardown.txs,
    ...(teardownError !== undefined ? { teardownError } : {}),
    runs: opts.runs,
    pollMs: opts.pollMs,
    slowPollMs: slow.ms,
    slowLevels: [...slow.levels],
    overlapAfter: gate,
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
  // Runs are append-only: a second run of the same chain in the same minute must not replace the first.
  writeFileSync(file, `${JSON.stringify(run, null, 2)}\n`, { flag: "wx" });
  rmSync(partialPath(run.chain, run.stamp), { force: true });
  return file;
}

/** Where a run in progress keeps its transfers so far: `runs/<chain>/<stamp>.partial.json`, never
 *  committed, deleted when the run file is written. A process that dies hours in leaves this. */
export function partialPath(chain: string, stamp: string): string {
  return join(root, "runs", chain, `${stamp}.partial.json`);
}

export function writePartial(chain: string, stamp: string, transfers: readonly Transfer[]): void {
  const dir = join(root, "runs", chain);
  mkdirSync(dir, { recursive: true });
  writeFileSync(partialPath(chain, stamp), `${JSON.stringify({ chain, stamp, partial: true, transfers }, null, 2)}\n`);
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
