import assert from "node:assert/strict";
import { test } from "node:test";

import { hostOf, maybe, MissingVariable, need, redacted } from "./env.ts";

test("hostOf shows the host and nothing after it", () => {
  assert.equal(hostOf("https://mainnet.helius-rpc.com/?api-key=SECRET"), "mainnet.helius-rpc.com");
  assert.equal(hostOf("https://rpc.example.com:8899/v2/SECRET"), "rpc.example.com:8899");
  assert.equal(hostOf("SECRET"), "(not a URL)");
});

test("need names the missing variable; empty counts as missing", () => {
  process.env.TXF_TEST_EMPTY = "";
  assert.throws(() => need("TXF_TEST_EMPTY"), (e: unknown) => e instanceof MissingVariable && e.variable === "TXF_TEST_EMPTY");
  assert.equal(maybe("TXF_TEST_EMPTY"), undefined);
  process.env.TXF_TEST_SET = "x";
  assert.equal(need("TXF_TEST_SET"), "x");
});

test("redacted() keeps only the host of any *_URL variable an error quotes", () => {
  const env = { BASE_RPC_URL: "https://base-mainnet.example.io/v3/0123456789abcdef0123456789abcdef", SHORT_URL: "x", OTHER: "https://base-mainnet.example.io/v3/0123456789abcdef0123456789abcdef" };
  const e = new Error("Missing or invalid parameters.\n\nURL: https://base-mainnet.example.io/v3/0123456789abcdef0123456789abcdef\nRequest body: {}");
  const out = redacted(e, env);
  assert.ok(!out.includes("0123456789abcdef"), out);
  assert.ok(out.includes("URL: base-mainnet.example.io/…"), out);
  assert.equal(redacted("plain text", env), "plain text");
});
