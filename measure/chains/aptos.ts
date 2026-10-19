// Aptos. One transfer = one transaction calling `0x1::primary_fungible_store::transfer` for the
// asset (USDC is a fungible asset, named by its metadata object). There is one level: committed,
// which the docs call final (BFT, no further confirmations). The full node answers
// `GET /transactions/by_hash/{hash}` with `pending_transaction` while the transaction sits in the
// mempool and `user_transaction` once it is committed, with `success` saying whether it did what
// it was asked.
//
// Only the sender's key is held. The recipient is derived from it (sha256 of the key with a tag,
// used as an ed25519 private key). Setup gives the recipient APT for the return; teardown sends
// the asset and the APT back, both outside the clock. `APTOS_API_URL` is the REST base
// (`https://api.mainnet.aptoslabs.com/v1`); `APTOS_API_KEY` is sent as a bearer token when set.
import { createHash } from "node:crypto";

import {
  Account,
  type AccountAddress,
  Aptos,
  AptosConfig,
  Ed25519PrivateKey,
  Network,
  type SimpleTransaction,
} from "@aptos-labs/ts-sdk";

import type { Chain } from "../chain.ts";
import type { Driver, Signed, Status } from "../driver.ts";
import { maybe, need } from "../env.ts";

const OCTAS = 100_000_000n;
/** APT the recipient gets for its return: a fungible-asset transfer and a coin transfer */
const RECIPIENT_GAS = OCTAS / 50n; // 0.02 APT

/** The private key as `txfinality wallet` writes it: 32 bytes, hex, optionally 0x-prefixed. */
export function accountFrom(secret: string): Account {
  const hex = secret.trim().replace(/^0x/, "").replace(/^ed25519-priv-/, "");
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error("APTOS_FROM_KEY must be a 32-byte ed25519 private key in hex");
  return Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(Buffer.from(hex, "hex")) });
}

/** The recipient that belongs to a sender: derived, never stored. */
export function recipientOf(senderSecret: string): Account {
  const hex = senderSecret.trim().replace(/^0x/, "").replace(/^ed25519-priv-/, "");
  const seed = createHash("sha256").update("txfinality recipient v0").update(Buffer.from(hex, "hex")).digest();
  return Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(seed) });
}

export function aptos(chain: Chain): Driver {
  const url = need(chain.rpc.env).replace(/\/$/, "");
  const apiKey = maybe("APTOS_API_KEY");
  const client = new Aptos(
    new AptosConfig({
      network: Network.MAINNET,
      fullnode: url,
      ...(apiKey ? { clientConfig: { API_KEY: apiKey } } : {}),
    }),
  );
  const metadata = chain.asset.contract;
  if (chain.levels.length !== 1) throw new Error(`chains/${chain.id}.yaml: the aptos driver expects one level (committed)`);
  const level = chain.levels[0]?.name ?? "committed";

  let sender: Account | undefined;
  let recipient: Account | undefined;
  let decimals = -1;
  let amount = 0n;

  const keys = () => {
    const secret = need(chain.wallets.from_env);
    sender ??= accountFrom(secret);
    recipient ??= recipientOf(secret);
    return { sender, recipient };
  };
  const units = async (): Promise<void> => {
    if (decimals < 0) {
      const [d] = await client.view<[number]>({ payload: { function: "0x1::fungible_asset::decimals", typeArguments: ["0x1::fungible_asset::Metadata"], functionArguments: [metadata] } });
      decimals = Number(d);
      amount = BigInt(Math.round(Number(chain.asset.amount) * 10 ** decimals));
    }
  };
  const assetBalance = async (who: AccountAddress): Promise<bigint> => {
    const [b] = await client.view<[string]>({ payload: { function: "0x1::primary_fungible_store::balance", typeArguments: ["0x1::fungible_asset::Metadata"], functionArguments: [who, metadata] } });
    return BigInt(b);
  };
  const aptBalance = async (who: AccountAddress): Promise<bigint> => {
    try {
      return BigInt(await client.getAccountAPTAmount({ accountAddress: who }));
    } catch {
      return 0n; // an account that does not exist yet
    }
  };
  const assetTransfer = (from: Account, to: AccountAddress, units: bigint): Promise<SimpleTransaction> =>
    client.transaction.build.simple({
      sender: from.accountAddress,
      data: { function: "0x1::primary_fungible_store::transfer", typeArguments: ["0x1::fungible_asset::Metadata"], functionArguments: [metadata, to, units] },
      options: { expireTimestamp: Math.floor(Date.now() / 1000) + 120 },
    });
  const aptTransfer = (from: Account, to: AccountAddress, octas: bigint): Promise<SimpleTransaction> =>
    client.transaction.build.simple({
      sender: from.accountAddress,
      data: { function: "0x1::aptos_account::transfer", functionArguments: [to, octas] },
      options: { expireTimestamp: Math.floor(Date.now() / 1000) + 120 },
    });
  /** Signs, submits and waits for a committed, successful transaction (setup and teardown only). */
  const sendAndWait = async (signer: Account, tx: SimpleTransaction): Promise<string> => {
    const pending = await client.signAndSubmitTransaction({ signer, transaction: tx });
    const done = await client.waitForTransaction({ transactionHash: pending.hash, options: { checkSuccess: true, timeoutSecs: 120 } });
    return done.hash;
  };
  const fmt = (u: bigint): string => (Number(u) / 10 ** decimals).toString();
  const apt = (o: bigint): string => (Number(o) / 1e8).toString();

  return {
    levels: [level],

    get wallets() {
      const { sender, recipient } = keys();
      return { from: sender.accountAddress.toString(), to: recipient.accountAddress.toString() };
    },

    async setup() {
      const { sender, recipient } = keys();
      await units();
      const lines: string[] = [];
      const txs: string[] = [];
      const [gas, have, rGas] = await Promise.all([aptBalance(sender.accountAddress), assetBalance(sender.accountAddress), aptBalance(recipient.accountAddress)]);
      lines.push(`sender    ${sender.accountAddress.toString()}  ${apt(gas)} APT  ${fmt(have)} ${chain.asset.symbol}`);
      lines.push(`recipient ${recipient.accountAddress.toString()}  (derived from the sender's key)  ${apt(rGas)} APT`);
      if (have < amount) throw new Error(`the sender holds ${fmt(have)} ${chain.asset.symbol}; fund it first`);
      if (rGas < RECIPIENT_GAS) {
        // aptos_account::transfer creates the recipient's account if it does not exist yet
        txs.push(await sendAndWait(sender, await aptTransfer(sender, recipient.accountAddress, RECIPIENT_GAS - rGas)));
        lines.push(`gave the recipient APT for the return (not timed): ${txs[txs.length - 1]}`);
      }
      return { lines, txs };
    },

    async prepare(): Promise<Signed> {
      const { sender, recipient } = keys();
      await units();
      const tx = await assetTransfer(sender, recipient.accountAddress, amount);
      const auth = client.transaction.sign({ signer: sender, transaction: tx });
      // the hash the node will know the transaction by, computed here so the clock need not wait for it
      const { generateSignedTransaction, generateUserTransactionHash } = await import("@aptos-labs/ts-sdk");
      const raw = generateSignedTransaction({ transaction: tx, senderAuthenticator: auth });
      const id = generateUserTransactionHash({ transaction: tx, senderAuthenticator: auth });
      return { id, raw };
    },

    async send(signed) {
      const r = await fetch(`${url}/transactions`, {
        method: "POST",
        headers: { "content-type": "application/x.aptos.signed_transaction+bcs", ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
        body: Buffer.from(signed.raw),
      });
      if (!r.ok) throw new Error(`submit: HTTP ${r.status} ${(await r.text()).slice(0, 160)}`);
    },

    async status(ids) {
      const out = new Map<string, Status>();
      for (const id of ids) {
        const r = await fetch(`${url}/transactions/by_hash/${id}`, { headers: { accept: "application/json", ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) } });
        if (r.status === 404) {
          out.set(id, { level: null });
          continue;
        }
        if (!r.ok) throw new Error(`by_hash: HTTP ${r.status}`);
        const t = (await r.json()) as { type: string; success?: boolean; vm_status?: string };
        if (t.type === "pending_transaction") out.set(id, { level: null });
        else if (t.success === false) out.set(id, { level, failed: t.vm_status ?? "aborted" });
        else out.set(id, { level });
      }
      return out;
    },

    async teardown() {
      const { sender, recipient } = keys();
      await units();
      const lines: string[] = [];
      const txs: string[] = [];
      const held = await assetBalance(recipient.accountAddress);
      if (held > 0n) {
        txs.push(await sendAndWait(recipient, await assetTransfer(recipient, sender.accountAddress, held)));
        lines.push(`returned ${fmt(held)} ${chain.asset.symbol}: ${txs[txs.length - 1]}`);
      }
      const left = await aptBalance(recipient.accountAddress);
      const keep = OCTAS / 500n; // 0.002 APT stays for the fee of this very transfer
      if (left > keep * 2n) {
        txs.push(await sendAndWait(recipient, await aptTransfer(recipient, sender.accountAddress, left - keep)));
        lines.push(`returned ${apt(left - keep)} APT: ${txs[txs.length - 1]}`);
      } else if (held === 0n) {
        lines.push("the recipient holds nothing to return");
      }
      return { lines, txs };
    },
  };
}
