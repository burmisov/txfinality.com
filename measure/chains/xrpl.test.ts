import assert from "node:assert/strict";
import { test } from "node:test";

import { Wallet } from "xrpl";

import { issued, recipientOf, walletFrom } from "./xrpl.ts";

test("the XRPL recipient is derived from the sender's seed and differs from it", () => {
  const w = Wallet.generate();
  const seed = w.seed ?? "";
  const r = recipientOf(seed);
  assert.notEqual(r.classicAddress, walletFrom(seed).classicAddress);
  assert.equal(recipientOf(seed).classicAddress, r.classicAddress);
});

test("an issued currency is read from CURRENCY.issuer", () => {
  assert.deepEqual(issued("USDC.rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE", "0.1"), { currency: "USDC", issuer: "rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE", value: "0.1" });
  assert.throws(() => issued("USDC", "1"), /CURRENCY\.issuer/);
});
