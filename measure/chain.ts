// One chain = one hand-kept file in `chains/<id>.yaml`. This reads it, checks the fields the
// runner relies on, and records the file's hash so a run can say which version it was made under.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parse } from "yaml";

import { root } from "./root.ts";

/** `done-final`: one level is both the earliest safe level and the last one (Aptos, XRPL, TON). */
export type Level = { name: string; detect: string; role?: "done" | "final" | "done-final"; seconds?: number };

export type Chain = {
  id: string;
  name: string;
  family: string;
  status: "measured" | "by-design" | "candidate" | "dropped";
  /** EVM chains: the chain id the transaction is signed for */
  chainId?: number;
  /** `gas: true` when the asset is also the chain's gas token (Arc): the return is a sweep */
  asset: { symbol: string; contract: string; amount: string; gas?: boolean };
  rpc: { env: string; provider: string };
  /** only the sender's key; the recipient is the driver's own, derived from it */
  wallets: { from_env: string };
  levels: Level[];
  claim: { text: string; url: string; read_on: string; next_read: string };
  note: string;
  /** sha256 of the yaml file, hex. */
  hash: string;
};

export function chainPath(id: string): string {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`not a chain id: ${id}`);
  return join(root, "chains", `${id}.yaml`);
}

export function loadChain(id: string): Chain {
  const text = readFileSync(chainPath(id), "utf8");
  const raw = parse(text) as Record<string, unknown>;
  const chain = { ...(raw as Omit<Chain, "hash">), hash: createHash("sha256").update(text).digest("hex") };
  check(chain);
  return chain;
}

function check(c: Chain): void {
  const missing: string[] = [];
  for (const key of ["id", "name", "family", "status", "asset", "rpc", "wallets", "levels"] as const) {
    if (c[key] === undefined || c[key] === null) missing.push(key);
  }
  if (missing.length) throw new Error(`chains/${c.id ?? "?"}.yaml lacks: ${missing.join(", ")}`);
  if (!Array.isArray(c.levels) || c.levels.length === 0) throw new Error(`chains/${c.id}.yaml: no levels`);
  const last = c.levels[c.levels.length - 1]?.role;
  if (last !== "final" && last !== "done-final") {
    throw new Error(`chains/${c.id}.yaml: the last level must be the final one (role: final or done-final)`);
  }
  if (!c.levels.some((l) => l.role === "done" || l.role === "done-final")) {
    throw new Error(`chains/${c.id}.yaml: no level has role: done`);
  }
}

/** A level the docs put at a minute or more is polled slowly (see run.ts): there is nothing to gain
 *  from asking ten times a second for twenty minutes, and the RPC is somebody's. */
export const SLOW_LEVEL_SECONDS = 60;
export function slowLevels(c: Chain): string[] {
  return c.levels.filter((l) => (l.seconds ?? 0) >= SLOW_LEVEL_SECONDS).map((l) => l.name);
}

export function roleLevel(c: Chain, role: "done" | "final"): string {
  const level = c.levels.find((l) => l.role === role || l.role === "done-final");
  if (!level) throw new Error(`chains/${c.id}.yaml: no level has role: ${role}`);
  return level.name;
}
