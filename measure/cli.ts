// `npx txfinality <command>`:
//   measure --chain <id> [--runs 20] [--poll-ms 250] [--cap-minutes 30] [--machine "name, place"]
//   watch   --chain <id> [--limit 10] [--poll-ms 500]    time other people's transfers; sends nothing
//   wallet  --chain <id>                                 make a sender and a recipient; writes .env
import { appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

import { loadChain, roleLevel } from "./chain.ts";
import { solana } from "./chains/solana.ts";
import type { Driver } from "./driver.ts";
import { hostOf, loadEnv, maybe, MissingVariable, need } from "./env.ts";
import { root } from "./root.ts";
import { measure, summary, watchLevels, writeRun, type Transfer } from "./run.ts";

const drivers: Record<string, (chain: ReturnType<typeof loadChain>) => Driver> = { solana };

const usage = `usage:
  txfinality measure --chain <id> [--runs 20] [--poll-ms 250] [--cap-minutes 30] [--machine "runner-1"]
  txfinality watch   --chain <id> [--limit 10] [--poll-ms 500]
  txfinality wallet  --chain <id>`;

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  const { values } = parseArgs({
    args: rest,
    options: {
      chain: { type: "string" },
      runs: { type: "string", default: "20" },
      "poll-ms": { type: "string" },
      "cap-minutes": { type: "string", default: "30" },
      machine: { type: "string" },
      limit: { type: "string", default: "10" },
    },
    strict: true,
  });
  if (!command || !["measure", "watch", "wallet"].includes(command) || !values.chain) {
    console.error(usage);
    return 2;
  }
  loadEnv();
  const chain = loadChain(values.chain);
  if (command === "wallet") return wallet(chain.id, chain.wallets.from_env, chain.wallets.to_env);

  const make = drivers[chain.family];
  if (!make) {
    console.error(`no driver for family "${chain.family}" yet (have: ${Object.keys(drivers).join(", ")})`);
    return 2;
  }
  const driver = make(chain);
  const rpc = hostOf(need(chain.rpc.env));

  if (command === "measure") {
    const runs = Number(values.runs);
    const pollMs = Number(values["poll-ms"] ?? 250);
    const capMinutes = Number(values["cap-minutes"]);
    console.log(`$ txfinality measure --chain ${chain.id} --runs ${runs}   (rpc: ${rpc}, poll ${pollMs} ms, cap ${capMinutes} min)`);
    const run = await measure(chain, driver, { runs, pollMs, capMinutes, machine: values.machine, rpc });
    for (const line of summary(run, chain)) console.log(line);
    const file = writeRun(run);
    console.log(`saved ${file.slice(root.length + 1)}`);
    return run.slowest.final === null ? 1 : 0;
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
  console.log(`clock starts at first sight, not at sending: these figures are lower than a real run's`);
  const ids = await driver.recent(limit);
  const seen = Date.now();
  if (ids.length === 0) {
    console.log("no transfer at the first level right now; try again");
    return 1;
  }
  const transfers: Transfer[] = ids.map((id) => ({ id, sent: new Date(seen).toISOString(), levels: {} }));
  const sentAt = new Map(ids.map((id) => [id, seen]));
  await watchLevels(driver, transfers, sentAt, seen + 5 * 60_000, pollMs, () => false);
  const done = roleLevel(chain, "done");
  const final = roleLevel(chain, "final");
  for (const t of transfers) {
    console.log(`${t.id}  ${done} ${t.levels[done] ?? "?"}s  ${final} ${t.levels[final] ?? "?"}s`);
  }
  return 0;
}

/** Makes a sender and a recipient for the chain, writes their keys to `.env` (mode 0600) and
 *  prints only addresses. Refuses if the sender variable is already set anywhere. */
function wallet(chain: string, fromEnv: string, toEnv: string): number {
  if (chain !== "solana") {
    console.error("wallet: only solana so far");
    return 2;
  }
  if (maybe(fromEnv) !== undefined) {
    console.error(`${fromEnv} is already set; not overwriting a key. Unset it or edit .env by hand.`);
    return 1;
  }
  const from = Keypair.generate();
  const to = Keypair.generate();
  const file = join(root, ".env");
  const fresh = !existsSync(file);
  const block = [
    `# solana · made by \`txfinality wallet\` on ${new Date().toISOString().slice(0, 10)}`,
    `${fromEnv}=${bs58.encode(from.secretKey)}`,
    `${toEnv}=${to.publicKey.toBase58()}`,
    `SOLANA_TO_KEY=${bs58.encode(to.secretKey)}`,
    "",
  ].join("\n");
  appendFileSync(file, (fresh ? "" : "\n") + block, { mode: 0o600 });
  console.log(`wrote ${fromEnv}, ${toEnv} and SOLANA_TO_KEY to .env (keys stay there; never commit it)`);
  console.log(`sender    ${from.publicKey.toBase58()}   fund: a little SOL for fees and the USDC to send`);
  console.log(`recipient ${to.publicKey.toBase58()}   needs nothing; its key is in .env to move funds back`);
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e: unknown) => {
    if (e instanceof MissingVariable) console.error(e.message);
    else console.error(e);
    process.exit(1);
  },
);
