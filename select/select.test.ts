import assert from "node:assert/strict";
import { test } from "node:test";

import { CUT, landscape, slug } from "./select.ts";

test("slug is lower-case, dashed, trimmed", () => {
  assert.equal(slug("Hyperliquid L1"), "hyperliquid-l1");
  assert.equal(slug("OP Mainnet"), "op-mainnet");
  assert.equal(slug(" X Layer "), "x-layer");
});

test("the landscape ranks by total stablecoin USD, cuts at CUT, maps known names, and always lists Bitcoin", () => {
  const llama = [];
  for (let i = 0; i < 30; i++) llama.push({ name: `Chain ${i}`, totalCirculatingUSD: { peggedUSD: 1e9 - i * 1e6 } });
  llama.push({ name: "Solana", totalCirculatingUSD: { peggedUSD: 15e9, peggedEUR: 0.5e9 } });
  llama.push({ name: "BSC", totalCirculatingUSD: { peggedUSD: 13e9 } });
  const gecko = [
    { id: "solana", market_cap: 60e9 },
    { id: "bitcoin", market_cap: 1600e9 },
  ];
  const l = landscape(llama, gecko, new Date("2026-10-18T12:00:00Z"));
  assert.equal(l.date, "2026-10-18");
  assert.equal(l.cut, CUT);
  const [first, second] = l.chains;
  assert.ok(first && second);
  assert.equal(first.id, "solana");
  assert.equal(first.stablecoinsUsd, 15.5e9, "every peg counts");
  assert.equal(first.marketCapUsd, 60e9);
  assert.equal(first.status, "measured", "read from chains/solana.yaml");
  assert.equal(second.id, "bnb");
  assert.equal(second.marketCapUsd, null, "binancecoin was not in the answer");
  assert.equal(l.chains.filter((c) => c.inside).length, CUT);
  assert.equal(l.chains.find((c) => c.name === "Chain 0")?.id, "chain-0");
  assert.equal(l.chains.find((c) => c.name === "Chain 0")?.status, "no chain file");
  const btc = l.chains.find((c) => c.id === "bitcoin");
  assert.ok(btc);
  assert.equal(btc.rank, null, "not in the source's list at all");
  assert.equal(btc.inside, false);
  assert.equal(btc.marketCapUsd, 1600e9);
  assert.equal(btc.listed, true);
  assert.equal(l.chains.find((c) => c.name === "Chain 0")?.listed, true, "inside the cut");
  assert.equal(l.chains.find((c) => c.name === "Chain 20")?.listed, false, "below the cut and not by decision");
});
