import assert from "node:assert/strict";
import { test } from "node:test";
import { performance } from "node:perf_hooks";

import type { Chain } from "./chain.ts";
import type { Driver, Status } from "./driver.ts";
import { measure, notReached, reached, slowest, stampOf, type Transfer, watchOne } from "./run.ts";

const levels = ["processed", "confirmed", "finalized"] as const;

const chain: Chain = {
  id: "fake",
  name: "Fake",
  family: "fake",
  status: "candidate",
  asset: { symbol: "USDC", contract: "x", amount: "1" },
  rpc: { env: "FAKE_RPC_URL", provider: "" },
  wallets: { from_env: "FAKE_FROM_KEY" },
  levels: [
    { name: "processed", detect: "" },
    { name: "confirmed", detect: "", role: "done" },
    { name: "finalized", detect: "", role: "final" },
  ],
  claim: { text: "", url: "", read_on: "", next_read: "" },
  note: "",
  hash: "0",
};

/** A fake chain where a transfer climbs one level per poll, and `failing` ones fail on the second. */
function fakeDriver(failing: string[] = []): Driver & { log: string[] } {
  const polls = new Map<string, number>();
  const log: string[] = [];
  return {
    log,
    levels,
    wallets: { from: "F", to: "T" },
    setup: async () => {
      log.push("setup");
      return { lines: ["set up"], txs: ["s1"] };
    },
    prepare: async (i) => {
      log.push(`prepare ${i}`);
      return { id: `t${i}`, raw: new Uint8Array() };
    },
    send: async (s) => {
      log.push(`send ${s.id}`);
    },
    status: async (ids) => {
      const m = new Map<string, Status>();
      for (const id of ids) {
        const n = (polls.get(id) ?? 0) + 1;
        polls.set(id, n);
        log.push(`poll ${id}`);
        if (failing.includes(id) && n >= 2) m.set(id, { level: "processed", failed: "InsufficientFunds" });
        else m.set(id, { level: levels[Math.min(n, 3) - 1] ?? null });
      }
      return m;
    },
    teardown: async () => {
      log.push("teardown");
      return { lines: ["torn down"], txs: ["c1"] };
    },
  };
}

test("a chain reporting a late level has passed the earlier ones", () => {
  assert.deepEqual(reached(levels, "finalized"), ["processed", "confirmed", "finalized"]);
  assert.deepEqual(reached(levels, "processed"), ["processed"]);
  assert.deepEqual(reached(levels, null), []);
  assert.deepEqual(reached(levels, "unknown"), []);
});

test("slowest is the maximum, and null when any transfer lacks the level", () => {
  const t: Transfer[] = [
    { id: "a", sent: "", levels: { confirmed: 0.9, finalized: 12.1 }, polls: 0 },
    { id: "b", sent: "", levels: { confirmed: 1.3 }, polls: 0 },
  ];
  assert.equal(slowest(t, "confirmed"), 1.3);
  assert.equal(slowest(t, "finalized"), null);
  assert.deepEqual(notReached(t, levels), [
    { id: "a", level: "processed" },
    { id: "b", level: "processed" },
  ]);
});

test("the stamp is minute-exact and file-safe", () => {
  assert.equal(stampOf(new Date("2026-10-18T16:40:12.031Z")), "2026-10-18T1640Z");
});

test("watchOne times levels from the send instant, in order, and stops at final", async () => {
  const driver = fakeDriver();
  const t: Transfer = { id: "t0", sent: "", levels: {}, polls: 0 };
  const lines: string[] = [];
  await watchOne(driver, t, performance.now() - 1000, 10_000, 1, (l) => lines.push(l));
  assert.deepEqual(Object.keys(t.levels), ["processed", "confirmed", "finalized"]);
  assert.ok((t.levels.processed ?? 0) >= 1, "the clock started a second before");
  assert.ok((t.levels.processed ?? 99) <= (t.levels.confirmed ?? 0));
  assert.ok((t.levels.confirmed ?? 99) <= (t.levels.finalized ?? 0));
  assert.equal(t.polls, 3);
  assert.equal(lines.length, 3);
});

test("watchOne stops on a failure and at the cap, keeping what it saw", async () => {
  const failing = fakeDriver(["t0"]);
  const f: Transfer = { id: "t0", sent: "", levels: {}, polls: 0 };
  await watchOne(failing, f, performance.now(), 10_000, 1, () => {});
  assert.equal(f.failed, "InsufficientFunds");
  assert.deepEqual(Object.keys(f.levels), ["processed"]);

  const slow: Driver = {
    ...fakeDriver(),
    status: async (ids) => new Map(ids.map((id) => [id, { level: "confirmed" } as Status])),
  };
  const c: Transfer = { id: "t1", sent: "", levels: {}, polls: 0 };
  await watchOne(slow, c, performance.now(), 20, 5, () => {});
  assert.deepEqual(Object.keys(c.levels), ["processed", "confirmed"]);
  assert.deepEqual(notReached([c], levels), [{ id: "t1", level: "finalized" }]);
});

test("measure sends transfers one at a time: the next is built only after the last is final", async () => {
  const driver = fakeDriver();
  const run = await measure(chain, driver, { runs: 3, pollMs: 1, capMinutes: 1, rpc: "rpc", log: () => {} });
  const order = driver.log.filter((l) => !l.startsWith("poll"));
  assert.deepEqual(order, [
    "setup",
    "prepare 0",
    "send t0",
    "prepare 1",
    "send t1",
    "prepare 2",
    "send t2",
    "teardown",
  ]);
  // between a send and the next prepare, every poll is for the transfer just sent
  const log = driver.log;
  for (let i = 0; i < log.length; i++) {
    const m = /^send (t\d)$/.exec(log[i] ?? "");
    if (!m) continue;
    for (let j = i + 1; j < log.length && log[j]?.startsWith("poll"); j++) {
      assert.equal(log[j], `poll ${m[1]}`);
    }
  }
  assert.equal(run.transfers.length, 3);
  assert.equal(run.notReached.length, 0);
  assert.ok(run.slowest.done !== null && run.slowest.final !== null);
  assert.deepEqual(run.setup, ["s1"]);
  assert.deepEqual(run.teardown, ["c1"]);
  assert.deepEqual(run.wallets, { from: "F", to: "T" });
  assert.equal(run.amount, "1");
});

test("measure tears down even when a transfer throws", async () => {
  const driver = fakeDriver();
  driver.send = async () => {
    throw new Error("rpc down");
  };
  await assert.rejects(measure(chain, driver, { runs: 1, pollMs: 1, capMinutes: 1, rpc: "rpc", log: () => {} }), /rpc down/);
  assert.ok(driver.log.includes("teardown"));
});

test("pollFor slows only while the next unreached level is a slow one", async () => {
  const { pollFor } = await import("./run.ts");
  const levels = ["in a block", "posted to L1", "L1 finalized"];
  const slow = { ms: 2000, levels: ["posted to L1", "L1 finalized"] };
  const t = { id: "x", sent: "", levels: {} as Record<string, number>, polls: 0 };
  assert.equal(pollFor(levels, t, 100, slow), 100);
  t.levels["in a block"] = 0.3;
  assert.equal(pollFor(levels, t, 100, slow), 2000);
  assert.equal(pollFor(levels, t, 5000, slow), 5000);
  assert.equal(pollFor(levels, t, 100, undefined), 100);
});
