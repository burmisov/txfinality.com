// Solana. One transfer = one transaction carrying a token `transferChecked` of the asset, a memo
// naming the run, and a small priority fee. Levels are the three commitments the RPC reports
// for a signature: processed, confirmed, finalized. One `getSignatureStatuses` call covers every
// transfer in the run, so polling costs one round trip however many are open.
import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  TokenAccountNotFoundError,
} from "@solana/spl-token";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";

import type { Chain } from "../chain.ts";
import type { Driver, Signed, Status } from "../driver.ts";
import { need } from "../env.ts";

const MEMO = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const LEVELS = ["processed", "confirmed", "finalized"] as const;

/** A secret key as `solana-keygen` writes it (a JSON array) or as wallets export it (base58). */
export function keypairFrom(secret: string): Keypair {
  const s = secret.trim();
  const bytes = s.startsWith("[") ? Uint8Array.from(JSON.parse(s) as number[]) : bs58.decode(s);
  return Keypair.fromSecretKey(bytes);
}

export function solana(chain: Chain): Driver {
  const connection = new Connection(need(chain.rpc.env), { commitment: "processed" });
  const mint = new PublicKey(chain.asset.contract);
  // Keys are read only when a transfer is about to be made: `watch` never touches them.
  let from!: Keypair;
  let to!: PublicKey;
  let fromAta!: PublicKey;
  let toAta!: PublicKey;
  let decimals = 0;
  let amount = 0n;

  return {
    levels: LEVELS,

    async setup() {
      from = keypairFrom(need(chain.wallets.from_env));
      to = new PublicKey(need(chain.wallets.to_env));
      fromAta = getAssociatedTokenAddressSync(mint, from.publicKey);
      toAta = getAssociatedTokenAddressSync(mint, to);
      const lines: string[] = [];
      decimals = (await getMint(connection, mint, "confirmed")).decimals;
      amount = BigInt(Math.round(Number(chain.asset.amount) * 10 ** decimals));
      const sol = (await connection.getBalance(from.publicKey, "confirmed")) / 1e9;
      lines.push(`from ${from.publicKey.toBase58()} · ${sol} SOL`);
      const have = await balance(connection, fromAta);
      lines.push(`  ${Number(have) / 10 ** decimals} ${chain.asset.symbol}`);
      lines.push(`to   ${to.toBase58()}`);
      const toExists = (await balance(connection, toAta, true)) !== null;
      if (!toExists) {
        // The recipient's token account is created once, before the clock starts, so a run
        // measures transfers and not account creation.
        const tx = new Transaction().add(
          createAssociatedTokenAccountInstruction(from.publicKey, toAta, to, mint),
        );
        await sendAndConfirmTransaction(connection, tx, [from], { commitment: "confirmed" });
        lines.push("  created the recipient's token account (one-time, not timed)");
      }
      return lines;
    },

    async prepare(_i, _n, tag): Promise<Signed> {
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const tx = new Transaction({ feePayer: from.publicKey, recentBlockhash: blockhash }).add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 40_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
        createTransferCheckedInstruction(fromAta, mint, toAta, from.publicKey, amount, decimals),
        new TransactionInstruction({ keys: [], programId: MEMO, data: Buffer.from(tag, "utf8") }),
      );
      tx.sign(from);
      const sig = tx.signature;
      if (!sig) throw new Error("unsigned");
      return { id: bs58.encode(sig), raw: tx.serialize() };
    },

    async send(signed) {
      // No preflight: a simulation would add a round trip before the bytes leave, and the
      // clock is already running. A transfer that cannot land shows up as `failed` instead.
      await connection.sendRawTransaction(signed.raw, { skipPreflight: true });
    },

    status: (ids) => statuses(connection, ids),

    async recent(limit) {
      // The RPC lists an address's signatures at `confirmed` at the earliest, never `processed`,
      // so a watch starts one level up: it times confirmed → finalized, not processed.
      // Behind a load balancer the next call may land on a node a slot or two behind or ahead,
      // so anything not yet finalized is worth watching; what is already final is skipped.
      const seen = await connection.getSignaturesForAddress(mint, { limit }, "confirmed");
      return seen.filter((s) => s.confirmationStatus !== "finalized" && s.err === null).map((s) => s.signature);
    },
  };
}

export async function statuses(connection: Connection, ids: readonly string[]): Promise<Map<string, Status>> {
  const out = new Map<string, Status>();
  // The RPC answers for up to 256 signatures per call from its recent-status cache.
  for (let i = 0; i < ids.length; i += 256) {
    const slice = ids.slice(i, i + 256);
    const { value } = await connection.getSignatureStatuses([...slice]);
    slice.forEach((id, j) => {
      const s = value[j];
      if (!s) {
        out.set(id, { level: null });
        return;
      }
      const status: Status = { level: s.confirmationStatus ?? "processed" };
      if (s.err !== null) status.failed = JSON.stringify(s.err);
      out.set(id, status);
    });
  }
  return out;
}

async function balance(connection: Connection, ata: PublicKey, orNull = false): Promise<bigint | null> {
  try {
    return (await getAccount(connection, ata, "confirmed")).amount;
  } catch (e) {
    if (e instanceof TokenAccountNotFoundError) {
      if (orNull) return null;
      return 0n;
    }
    throw e;
  }
}
