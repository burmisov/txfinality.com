import assert from "node:assert/strict";
import { test } from "node:test";

import { beginCell } from "@ton/core";
import { keyPairFromSeed } from "@ton/crypto";

import { keyPairFrom, opAndQuery, queryIdOf, recipientSeedOf } from "./ton.ts";

const seed = "11".repeat(32);

test("the TON recipient is derived from the sender's seed and differs from it", () => {
  const r = recipientSeedOf(seed);
  assert.equal(r.length, 32);
  assert.notEqual(r.toString("hex"), seed);
  assert.equal(recipientSeedOf(seed).toString("hex"), r.toString("hex"));
  assert.notEqual(keyPairFromSeed(r).publicKey.toString("hex"), keyPairFrom(seed).publicKey.toString("hex"));
  assert.throws(() => keyPairFrom("not hex"), /32-byte seed/);
});

test("a query id names the transfer, and a body's op and query id are read back", () => {
  const q = queryIdOf("txfinality ton 2026-10-19T1700Z 1/20");
  assert.notEqual(q, queryIdOf("txfinality ton 2026-10-19T1700Z 2/20"));
  const body = beginCell().storeUint(0x178d4519, 32).storeUint(q, 64).storeCoins(100000n).endCell();
  assert.deepEqual(opAndQuery(body), { op: 0x178d4519, queryId: q });
  assert.equal(opAndQuery(beginCell().endCell()), null);
});
