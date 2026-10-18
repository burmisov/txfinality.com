// Solana. One transfer = one transaction carrying a token `transferChecked` of the asset, a memo
// naming the run, and a small priority fee. Levels are the three commitments the RPC reports
// for a signature: processed, confirmed, finalized.
//
// Only the sender's key is held. The recipient is derived from it (sha256 of the key with a tag,
// used as a seed), so it is the same for every run, needs no storage, and can be recovered from
// the sender's key alone. Setup creates the recipient's token account, paid by the sender;
// teardown sends the asset back, closes that account and returns its rent to the sender. Both
// are ordinary confirmed transactions outside the clock.
import {
  createAssociatedTokenAccountInstruction,
  createCloseAccountInstruction,
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
} from "@solana/web3.js";
import bs58 from "bs58";
import { createHash } from "node:crypto";

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

/** The recipient that belongs to a sender: derived, never stored. */
export function recipientOf(sender: Keypair): Keypair {
  const seed = createHash("sha256").update("txfinality recipient v0").update(sender.secretKey).digest();
  return Keypair.fromSeed(seed);
}

export function solana(chain: Chain): Driver {
  const connection = new Connection(need(chain.rpc.env), { commitment: "processed" });
  const mint = new PublicKey(chain.asset.contract);
  // The key is read only when a transfer is about to be made or undone: `watch` never touches it.
  let from: Keypair | undefined;
  let to: Keypair | undefined;
  let decimals = 0;
  let amount = 0n;

  const keys = (): { from: Keypair; to: Keypair; fromAta: PublicKey; toAta: PublicKey } => {
    from ??= keypairFrom(need(chain.wallets.from_env));
    to ??= recipientOf(from);
    return {
      from,
      to,
      fromAta: getAssociatedTokenAddressSync(mint, from.publicKey),
      toAta: getAssociatedTokenAddressSync(mint, to.publicKey),
    };
  };
  const units = async (): Promise<void> => {
    if (decimals === 0) {
      decimals = (await getMint(connection, mint, "confirmed")).decimals;
      amount = BigInt(Math.round(Number(chain.asset.amount) * 10 ** decimals));
    }
  };
  // Setup and teardown transactions are confirmed by polling over HTTP: the library's own
  // confirmation opens a websocket, which not every RPC endpoint serves (Infura's does not).
  const confirm = async (tx: Transaction, signers: Keypair[]): Promise<string> => {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer ??= signers[0]?.publicKey;
    tx.sign(...signers);
    const sig = await connection.sendRawTransaction(tx.serialize());
    for (;;) {
      const s = (await statuses(connection, [sig])).get(sig);
      if (s?.failed !== undefined) throw new Error(`${sig} failed on chain: ${s.failed}`);
      if (s?.level === "confirmed" || s?.level === "finalized") return sig;
      if ((await connection.getBlockHeight("confirmed")) > lastValidBlockHeight) {
        throw new Error(`${sig} expired unconfirmed; check it before running again`);
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  };

  return {
    levels: LEVELS,

    get wallets() {
      const k = keys();
      return { from: k.from.publicKey.toBase58(), to: k.to.publicKey.toBase58() };
    },

    async setup() {
      const { from, to, fromAta, toAta } = keys();
      await units();
      const lines: string[] = [];
      const txs: string[] = [];
      const sol = (await connection.getBalance(from.publicKey, "confirmed")) / 1e9;
      const have = await balance(connection, fromAta);
      lines.push(`sender    ${from.publicKey.toBase58()}  ${sol} SOL  ${fmt(have ?? 0n, decimals)} ${chain.asset.symbol}`);
      lines.push(`recipient ${to.publicKey.toBase58()}  (derived from the sender's key)`);
      if (have === null) throw new Error(`the sender has no ${chain.asset.symbol} account: fund it first`);
      if ((await balance(connection, toAta)) === null) {
        const tx = new Transaction().add(
          createAssociatedTokenAccountInstruction(from.publicKey, toAta, to.publicKey, mint),
        );
        txs.push(await confirm(tx, [from]));
        lines.push(`created the recipient's token account (not timed): ${txs[txs.length - 1]}`);
      }
      return { lines, txs };
    },

    async prepare(_i, _n, tag): Promise<Signed> {
      const { from, fromAta, toAta } = keys();
      await units();
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

    async teardown() {
      const { from, to, fromAta, toAta } = keys();
      await units();
      const lines: string[] = [];
      const txs: string[] = [];
      const held = await balance(connection, toAta);
      if (held === null) {
        lines.push("the recipient has no token account: nothing to return");
        return { lines, txs };
      }
      // One transaction, paid by the sender, signed by both: the asset goes back, then the
      // empty account is closed and its rent goes to the sender. The recipient never holds SOL.
      const tx = new Transaction();
      if (held > 0n) {
        tx.add(createTransferCheckedInstruction(toAta, mint, fromAta, to.publicKey, held, decimals));
      }
      tx.add(createCloseAccountInstruction(toAta, from.publicKey, to.publicKey));
      tx.feePayer = from.publicKey;
      txs.push(await confirm(tx, [from, to]));
      lines.push(
        `returned ${fmt(held, decimals)} ${chain.asset.symbol} and closed the recipient's token account (rent back to the sender): ${txs[0]}`,
      );
      return { lines, txs };
    },

    async recent(limit) {
      // The RPC lists an address's signatures at `confirmed` at the earliest, never `processed`,
      // so a watch starts one level up: it times confirmed → finalized, not processed. Behind a
      // load balancer the next call may land on a node a slot or two off, so anything not yet
      // finalized is worth watching; what is already final is skipped.
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

/** The token balance of an account, or null when the account does not exist. */
async function balance(connection: Connection, ata: PublicKey): Promise<bigint | null> {
  try {
    return (await getAccount(connection, ata, "confirmed")).amount;
  } catch (e) {
    if (e instanceof TokenAccountNotFoundError) return null;
    throw e;
  }
}

function fmt(units: bigint, decimals: number): string {
  return (Number(units) / 10 ** decimals).toString();
}
