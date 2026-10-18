import assert from "node:assert/strict";
import { test } from "node:test";

import type { Driver, Status } from "./driver.ts";
import { notReached, reached, slowest, stampOf, type Transfer, watchLevels } from "./run.ts";

const levels = ["processed", "confirmed", "finalized"] as const;

test("a chain reporting a late level has passed the earlier ones", () => {
  assert.deepEqual(reached(levels, "finalized"), ["processed", "confirmed", "finalized"]);
  assert.deepEqual(reached(levels, "processed"), ["processed"]);
  assert.deepEqual(reached(levels, null), []);
  assert.deepEqual(reached(levels, "unknown"), []);
});

test("slowest is the maximum, and null when any transfer lacks the level", () => {
  const t: Transfer[] = [
    { id: "a", sent: "", levels: { confirmed: 0.9, finalized: 12.1 } },
    { id: "b", sent: "", levels: { confirmed: 1.3 } },
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

test("watchLevels times each level from the transfer's own send instant and stops at final", async () => {
  // A fake chain: transfer "a" climbs one level per poll; "b" fails on its second poll.
  let polls = 0;
  const driver: Driver = {
    levels,
    setup: async () => [],
    prepare: async () => ({ id: "x", raw: new Uint8Array() }),
    send: async () => {},
    status: async (ids) => {
      polls++;
      const m = new Map<string, Status>();
      for (const id of ids) {
        if (id === "a") m.set(id, { level: levels[Math.min(polls, 3) - 1] ?? null });
        if (id === "b") m.set(id, polls >= 2 ? { level: "processed", failed: "InsufficientFunds" } : { level: null });
      }
      return m;
    },
  };
  const now = Date.now();
  const transfers: Transfer[] = [
    { id: "a", sent: "", levels: {} },
    { id: "b", sent: "", levels: {} },
  ];
  const sentAt = new Map([
    ["a", now],
    ["b", now - 1000],
  ]);
  const lines: string[] = [];
  await watchLevels(driver, transfers, sentAt, now + 10_000, 5, () => false, (l) => lines.push(l));
  const a = transfers[0];
  const b = transfers[1];
  assert.ok(a && b);
  assert.deepEqual(Object.keys(a.levels), ["processed", "confirmed", "finalized"]);
  assert.ok((a.levels.processed ?? 99) <= (a.levels.confirmed ?? 0));
  assert.ok((a.levels.confirmed ?? 99) <= (a.levels.finalized ?? 0));
  assert.equal(b.failed, "InsufficientFunds");
  assert.ok((b.levels.processed ?? 0) >= 1, "b's clock started a second earlier");
  assert.equal(polls, 3, "stops once every transfer is final or failed");
  assert.ok(lines.some((l) => l.includes("failed on chain")));
});

test("watchLevels gives up at the deadline and keeps what it saw", async () => {
  const driver: Driver = {
    levels,
    setup: async () => [],
    prepare: async () => ({ id: "x", raw: new Uint8Array() }),
    send: async () => {},
    status: async (ids) => new Map(ids.map((id) => [id, { level: "confirmed" } as Status])),
  };
  const now = Date.now();
  const transfers: Transfer[] = [{ id: "a", sent: "", levels: {} }];
  await watchLevels(driver, transfers, new Map([["a", now]]), now + 30, 5, () => false, () => {});
  assert.deepEqual(Object.keys(transfers[0]?.levels ?? {}), ["processed", "confirmed"]);
  assert.deepEqual(notReached(transfers, levels), [{ id: "a", level: "finalized" }]);
});
