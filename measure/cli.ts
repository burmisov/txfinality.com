// `npx txfinality <command>`:
//   measure --chain <id> [--runs 20] [--poll-ms 100] [--cap-minutes 30] [--machine "name, place"]
//   watch   --chain <id> [--limit 10] [--poll-ms 500]    time other people's transfers; sends nothing
//   wallet  --chain <id>                                 make a sender; writes its key to .env
//   return  --chain <id>                                 undo a run's setup by hand: funds back, accounts closed
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { keyPairFromSeed } from "@ton/crypto";
import { WalletContractV4 } from "@ton/ton";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import { loadChain, roleLevel, slowLevels } from "./chain.ts";
import { evm } from "./chains/evm.ts";
import { solana } from "./chains/solana.ts";
import { ton } from "./chains/ton.ts";
import type { Driver } from "./driver.ts";
import { hostOf, loadEnv, maybe, MissingVariable, need, redacted } from "./env.ts";
import { root } from "./root.ts";
import { measure, summary, type Transfer, watchOne, writeRun } from "./run.ts";

const drivers: Record<string, (chain: ReturnType<typeof loadChain>) => Driver> = { solana, evm, ton };

const usage = `usage:
  txfinality measure --chain <id> [--runs 20] [--poll-ms 100] [--cap-minutes 30] [--slow "level,level"] [--slow-poll-ms 2000] [--machine "runner-1"]
  txfinality watch   --chain <id> [--limit 10] [--poll-ms 500]
  txfinality wallet  --chain <id>
  txfinality return  --chain <id>
  txfinality select                      the landscape: who holds the most dollars today → landscape/<date>.json`;

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  const { values } = parseArgs({
    args: rest,
    options: {
      chain: { type: "string" },
      runs: { type: "string", default: "20" },
      "poll-ms": { type: "string" },
      "cap-minutes": { type: "string", default: "30" },
      slow: { type: "string" },
      "slow-poll-ms": { type: "string" },
      machine: { type: "string" },
      limit: { type: "string", default: "10" },
    },
    strict: true,
  });
  if (command === "select") {
    const { select, describe } = await import("../select/select.ts");
    const { file, landscape } = await select();
    for (const line of describe(landscape)) console.log(line);
    console.log(`saved ${file.slice(root.length + 1)}`);
    return 0;
  }
  if (!command || !["measure", "watch", "wallet", "return"].includes(command) || !values.chain) {
    console.error(usage);
    return 2;
  }
  loadEnv();
  const chain = loadChain(values.chain);
  if (command === "wallet") return wallet(chain.family, chain.wallets.from_env);

  const make = drivers[chain.family];
  if (!make) {
    console.error(`no driver for family "${chain.family}" yet (have: ${Object.keys(drivers).join(", ")})`);
    return 2;
  }
  const driver = make(chain);
  const rpc = hostOf(need(chain.rpc.env));

  if (command === "measure") {
    const runs = Number(values.runs);
    const pollMs = Number(values["poll-ms"] ?? 100);
    const capMinutes = Number(values["cap-minutes"]);
    // levels to treat as slow (polled at 2 s; the final one overlapping, rule k): the chain file's
    // documented minute-or-more levels, or named here when the docs give no number
    const slow = values.slow ? values.slow.split(",").map((x) => x.trim()) : slowLevels(chain);
    for (const l of slow) if (!chain.levels.some((x) => x.name === l)) throw new Error(`--slow: "${l}" is not a level of ${chain.id}`);
    const slowPollMs = values["slow-poll-ms"] === undefined ? undefined : Number(values["slow-poll-ms"]);
    console.log(
      `$ txfinality measure --chain ${chain.id} --runs ${runs}   (rpc: ${rpc}, poll ${pollMs} ms, cap ${capMinutes} min per transfer)`,
    );
    const run = await measure(chain, driver, { runs, pollMs, capMinutes, machine: values.machine, rpc, slow, slowPollMs, partial: true });
    for (const line of summary(run, chain)) console.log(line);
    const file = writeRun(run);
    console.log(`saved ${file.slice(root.length + 1)}`);
    return run.slowest.final === null || run.teardownError !== undefined ? 1 : 0;
  }

  if (command === "return") {
    console.log(`$ txfinality return --chain ${chain.id}   (rpc: ${rpc})`);
    const { lines } = await driver.teardown();
    for (const line of lines) console.log(line);
    return 0;
  }

  // watch: pick transfers of the asset that the RPC has just seen at an early level, and time
  // their climb through the remaining levels from first sight. Nothing is sent, no key is needed.
  if (!driver.recent) {
    console.error(`the ${chain.family} driver cannot watch`);
    return 2;
  }
  const limit = Number(values.limit);
  const pollMs = Number(values["poll-ms"] ?? 500);
  console.log(`$ txfinality watch --chain ${chain.id} --limit ${limit}   (rpc: ${rpc}, poll ${pollMs} ms)`);
  console.log("clock starts at first sight, not at sending: these figures are lower than a real run's");
  const ids = await driver.recent(limit);
  const seen = performance.now();
  if (ids.length === 0) {
    console.log("no transfer short of final right now; try again");
    return 1;
  }
  const done = roleLevel(chain, "done");
  const final = roleLevel(chain, "final");
  const transfers: Transfer[] = ids.map((id) => ({ id, sent: new Date().toISOString(), levels: {}, polls: 0 }));
  // Watched one after another, as a run does; each gets five minutes of its own from when its
  // watch starts, while its clock still runs from first sight.
  for (const t of transfers) {
    console.log(t.id);
    await watchOne(driver, t, seen, 5 * 60_000 + (performance.now() - seen), pollMs);
  }
  for (const t of transfers) {
    console.log(`${t.id.slice(0, 8)}…  ${done} ${t.levels[done] ?? "?"}s  ${final} ${t.levels[final] ?? "?"}s`);
  }
  return 0;
}

/** Makes a sender for the chain, writes its key to `.env` (mode 0600) and prints only the address.
 *  Refuses if the sender variable is already set anywhere. The recipient is derived at run time. */
function wallet(family: string, fromEnv: string): number {
  if (maybe(fromEnv) !== undefined) {
    console.error(`${fromEnv} is already set; not overwriting a key. Unset it or edit .env by hand.`);
    return 1;
  }
  let secret: string;
  let address: string;
  let fund: string;
  if (family === "solana") {
    const kp = Keypair.generate();
    secret = bs58.encode(kp.secretKey);
    address = kp.publicKey.toBase58();
    fund = "a little SOL for fees and rent, and the USDC to send";
  } else if (family === "evm") {
    const key = generatePrivateKey();
    secret = key;
    address = privateKeyToAccount(key).address;
    fund = "a little gas on each EVM chain you will run, and the USDC to send there; the same address on every EVM chain";
  } else if (family === "ton") {
    const seed = randomBytes(32);
    secret = seed.toString("hex");
    address = WalletContractV4.create({ workchain: 0, publicKey: keyPairFromSeed(seed).publicKey }).address.toString({ bounceable: false });
    fund = "a little TON for fees (a transfer attaches 0.05 TON and gets most of it back), and the USDT to send; the wallet is a v4 contract, deployed by its first outgoing message";
  } else {
    console.error(`wallet: no key generator for family "${family}"`);
    return 2;
  }
  const file = join(root, ".env");
  const fresh = !existsSync(file);
  const block = [`# ${family} · made by \`txfinality wallet\` on ${new Date().toISOString().slice(0, 10)}`, `${fromEnv}=${secret}`, ""].join("\n");
  appendFileSync(file, (fresh ? "" : "\n") + block, { mode: 0o600 });
  console.log(`wrote ${fromEnv} to .env (the key stays there; never commit it)`);
  console.log(`sender ${address}   fund: ${fund}`);
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e: unknown) => {
    if (e instanceof MissingVariable) console.error(e.message);
    else console.error(redacted(e));
    process.exit(1);
  },
);
