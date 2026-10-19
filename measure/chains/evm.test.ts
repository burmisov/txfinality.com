import assert from "node:assert/strict";
import { test } from "node:test";

import { privateKeyToAccount } from "viem/accounts";

import { caughtUp, parseDetect, recipientKeyOf } from "./evm.ts";

test("detect strings parse, and unknown ones are refused with the list", () => {
  assert.deepEqual(parseDetect("receipt"), { kind: "receipt" });
  assert.deepEqual(parseDetect("block tag safe"), { kind: "tag", tag: "safe" });
  assert.deepEqual(parseDetect("block tag finalized"), { kind: "tag", tag: "finalized" });
  assert.deepEqual(parseDetect("confirmations 6"), { kind: "confirmations", n: 6 });
  assert.throws(() => parseDetect("block tag latest"), /unknown detect/);
});

test("the recipient is derived from the sender's key: same key, same recipient; another key, another", () => {
  const a = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
  const b = "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba";
  const ra = recipientKeyOf(a);
  assert.equal(ra, recipientKeyOf(a));
  assert.notEqual(ra, recipientKeyOf(b));
  assert.notEqual(ra, a);
  assert.match(ra, /^0x[0-9a-f]{64}$/);
  assert.ok(privateKeyToAccount(ra).address.startsWith("0x"), "a usable key");
});

test("feeCaps: the suggested gas price is the floor and the tip never exceeds it", async () => {
  const { feeCaps } = await import("./evm.ts");
  // BNB Chain: no base fee, node tip 1 gwei, suggested price 0.05 gwei
  assert.deepEqual(feeCaps(50_000_000n, 0n, 1_000_000_000n), { maxFeePerGas: 50_000_000n, maxPriorityFeePerGas: 50_000_000n });
  // a rollup: base 10, tip 1, suggested 11 → room for the base fee to double
  assert.deepEqual(feeCaps(11n, 10n, 1n), { maxFeePerGas: 21n, maxPriorityFeePerGas: 1n });
});

test("caughtUp() waits for a lagging node to show our transactions, and gives up loudly", async () => {
  const answers = [1, 1, 2];
  let asked = 0;
  await caughtUp(async () => answers[Math.min(asked++, answers.length - 1)] ?? 0, 2, 5_000, 1);
  assert.equal(asked, 3);
  await assert.rejects(caughtUp(async () => 1, 2, 20, 1), /fewer than 2 transactions/);
});
