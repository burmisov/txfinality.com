import assert from "node:assert/strict";
import { test } from "node:test";

import { privateKeyToAccount } from "viem/accounts";

import { parseDetect, recipientKeyOf } from "./evm.ts";

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
