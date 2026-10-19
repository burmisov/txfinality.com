import assert from "node:assert/strict";
import { test } from "node:test";

import { accountFrom, recipientOf } from "./aptos.ts";

const key = "22".repeat(32);

test("the Aptos recipient is derived from the sender's key and differs from it", () => {
  const s = accountFrom(key);
  const r = recipientOf(key);
  assert.notEqual(r.accountAddress.toString(), s.accountAddress.toString());
  assert.equal(recipientOf(`0x${key}`).accountAddress.toString(), r.accountAddress.toString());
  assert.throws(() => accountFrom("short"), /32-byte/);
});
