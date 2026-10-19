// XRP Ledger. One transfer = one Payment of the asset (USDC, an issued currency: `USDC.<issuer>`)
// from the sender to the recipient. There is one level, validated: the transaction sits in a
// validated ledger with result tesSUCCESS, which the docs call final. Before that the `tx` call
// answers txnNotFound, or the transaction with `validated: false` from a closed, unvalidated
// ledger, and neither is a level here.
//
// Only the sender's seed is held. The recipient is derived from it (sha256 of the seed with a tag,
// used as entropy). Issued currencies need a trust line: setup funds the recipient with XRP for its
// reserve and fees and has it set the trust line; teardown sends the asset back, removes the trust
// line and returns the XRP it can (the base reserve stays locked in the account, so the recipient
// keeps it for the next run). `XRPL_RPC_URL` is a JSON-RPC endpoint.
import { createHash } from "node:crypto";

import { Client, type Payment, type TrustSet, Wallet, xrpToDrops } from "xrpl";

import type { Chain } from "../chain.ts";
import type { Driver, Signed, Status } from "../driver.ts";
import { need } from "../env.ts";

/** XRP the recipient gets: the base reserve, the trust line's owner reserve, and fees. */
const RECIPIENT_XRP = "1.5";
/** ledgers a transfer may wait before it is dead for certain (a ledger closes every few seconds) */
const LEDGER_WINDOW = 20;

/** The seed as `txfinality wallet` writes it (sEd…, the family seed). */
export function walletFrom(secret: string): Wallet {
  return Wallet.fromSeed(secret.trim());
}

/** The recipient that belongs to a sender: derived, never stored. */
export function recipientOf(senderSeed: string): Wallet {
  const entropy = createHash("sha256").update("txfinality recipient v0").update(senderSeed.trim()).digest().subarray(0, 16);
  return Wallet.fromEntropy(Array.from(entropy));
}

/** `USDC.rIssuer…` → the amount object a Payment wants. */
export function issued(contract: string, value: string): { currency: string; issuer: string; value: string } {
  const [currency, issuer] = contract.split(".");
  if (!currency || !issuer) throw new Error(`asset.contract must be CURRENCY.issuer, not ${contract}`);
  return { currency, issuer, value };
}

export function xrpl(chain: Chain): Driver {
  const url = need(chain.rpc.env);
  const asset = issued(chain.asset.contract, "0");
  if (chain.levels.length !== 1) throw new Error(`chains/${chain.id}.yaml: the xrpl driver expects one level (validated)`);
  const level = chain.levels[0]?.name ?? "validated";

  let sender: Wallet | undefined;
  let recipient: Wallet | undefined;
  const lastLedger = new Map<string, number>();

  const keys = () => {
    const seed = need(chain.wallets.from_env);
    sender ??= walletFrom(seed);
    recipient ??= recipientOf(seed);
    return { sender, recipient };
  };
  const call = async <T>(method: string, params: Record<string, unknown> = {}): Promise<T> => {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ method, params: [params] }) });
    if (!r.ok) throw new Error(`${method}: HTTP ${r.status}`);
    const d = (await r.json()) as { result: T & { error?: string; error_message?: string; status?: string } };
    return d.result;
  };
  const validatedLedger = async (): Promise<number> => (await call<{ ledger_index: number }>("ledger", { ledger_index: "validated" })).ledger_index;
  const xrpBalance = async (address: string): Promise<number> => {
    const r = await call<{ account_data?: { Balance: string }; error?: string }>("account_info", { account: address, ledger_index: "validated" });
    return r.account_data ? Number(r.account_data.Balance) / 1e6 : 0;
  };
  const assetBalance = async (address: string): Promise<{ value: number; hasLine: boolean }> => {
    const r = await call<{ lines?: { currency: string; account: string; balance: string }[] }>("account_lines", { account: address, peer: asset.issuer, ledger_index: "validated" });
    const line = r.lines?.find((l) => l.currency === asset.currency && l.account === asset.issuer);
    return { value: line ? Number(line.balance) : 0, hasLine: line !== undefined };
  };
  const client = new Client(url.replace(/^http/, "ws"));
  /** Autofills, signs, submits and waits for validation (setup and teardown only); uses the library's websocket client. */
  const sendAndWait = async (wallet: Wallet, tx: Payment | TrustSet): Promise<string> => {
    if (!client.isConnected()) await client.connect();
    const prepared = await client.autofill(tx);
    const signed = wallet.sign(prepared);
    const res = await client.submitAndWait(signed.tx_blob);
    const meta = res.result.meta;
    const code = typeof meta === "object" && meta ? meta.TransactionResult : "unknown";
    if (code !== "tesSUCCESS") throw new Error(`${signed.hash}: ${code}`);
    return signed.hash;
  };

  return {
    levels: [level],

    get wallets() {
      const { sender, recipient } = keys();
      return { from: sender.classicAddress, to: recipient.classicAddress };
    },

    async setup() {
      const { sender, recipient } = keys();
      const lines: string[] = [];
      const txs: string[] = [];
      const [xrp, have, rXrp, rAsset] = await Promise.all([xrpBalance(sender.classicAddress), assetBalance(sender.classicAddress), xrpBalance(recipient.classicAddress), assetBalance(recipient.classicAddress)]);
      lines.push(`sender    ${sender.classicAddress}  ${xrp} XRP  ${have.value} ${chain.asset.symbol}`);
      lines.push(`recipient ${recipient.classicAddress}  (derived from the sender's seed)  ${rXrp} XRP${rAsset.hasLine ? "" : ", no trust line yet"}`);
      if (have.value < Number(chain.asset.amount)) throw new Error(`the sender holds ${have.value} ${chain.asset.symbol}; fund it first`);
      if (rXrp < Number(RECIPIENT_XRP)) {
        txs.push(await sendAndWait(sender, { TransactionType: "Payment", Account: sender.classicAddress, Destination: recipient.classicAddress, Amount: xrpToDrops((Number(RECIPIENT_XRP) - rXrp).toFixed(6)) }));
        lines.push(`gave the recipient XRP for its reserve and the return (not timed): ${txs[txs.length - 1]}`);
      }
      if (!rAsset.hasLine) {
        txs.push(await sendAndWait(recipient, { TransactionType: "TrustSet", Account: recipient.classicAddress, LimitAmount: issued(chain.asset.contract, "1000000") }));
        lines.push(`set the recipient's trust line for ${chain.asset.symbol} (not timed): ${txs[txs.length - 1]}`);
      }
      return { lines, txs };
    },

    async prepare(_i, _n, tag): Promise<Signed> {
      const { sender, recipient } = keys();
      const [info, ledger, fee] = await Promise.all([
        call<{ account_data: { Sequence: number } }>("account_info", { account: sender.classicAddress, ledger_index: "current" }),
        validatedLedger(),
        call<{ drops: { open_ledger_fee: string } }>("fee"),
      ]);
      const tx: Payment = {
        TransactionType: "Payment",
        Account: sender.classicAddress,
        Destination: recipient.classicAddress,
        Amount: issued(chain.asset.contract, chain.asset.amount),
        Sequence: info.account_data.Sequence,
        Fee: String(Math.max(12, Number(fee.drops.open_ledger_fee))),
        LastLedgerSequence: ledger + LEDGER_WINDOW,
        Memos: [{ Memo: { MemoData: Buffer.from(tag, "utf8").toString("hex").toUpperCase() } }],
      };
      const signed = sender.sign(tx);
      lastLedger.set(signed.hash, ledger + LEDGER_WINDOW);
      return { id: signed.hash, raw: Buffer.from(signed.tx_blob, "hex") };
    },

    async send(signed) {
      const r = await call<{ engine_result: string; engine_result_message?: string; error?: string }>("submit", { tx_blob: Buffer.from(signed.raw).toString("hex").toUpperCase() });
      if (r.error) throw new Error(`submit: ${r.error}`);
      // a tem/tef code means the ledger will never take it; tec/ter/tes are all "wait and see"
      if (/^te[mf]/.test(r.engine_result)) throw new Error(`submit: ${r.engine_result} ${r.engine_result_message ?? ""}`);
    },

    async status(ids) {
      const out = new Map<string, Status>();
      let current: number | undefined;
      for (const id of ids) {
        const r = await call<{ validated?: boolean; meta?: { TransactionResult: string }; error?: string }>("tx", { transaction: id });
        if (r.error === "txnNotFound" || !r.validated) {
          // not in a validated ledger yet; dead for certain once the window has passed
          current ??= await validatedLedger();
          const last = lastLedger.get(id);
          out.set(id, last !== undefined && current > last ? { level: level, failed: "expired: past LastLedgerSequence unvalidated" } : { level: null });
          continue;
        }
        const code = r.meta?.TransactionResult ?? "unknown";
        out.set(id, code === "tesSUCCESS" ? { level } : { level, failed: code });
      }
      return out;
    },

    async teardown() {
      const { sender, recipient } = keys();
      const lines: string[] = [];
      const txs: string[] = [];
      const held = await assetBalance(recipient.classicAddress);
      if (held.value > 0) {
        txs.push(await sendAndWait(recipient, { TransactionType: "Payment", Account: recipient.classicAddress, Destination: sender.classicAddress, Amount: issued(chain.asset.contract, String(held.value)) }));
        lines.push(`returned ${held.value} ${chain.asset.symbol}: ${txs[txs.length - 1]}`);
      } else {
        lines.push("the recipient holds nothing to return");
      }
      // The trust line and the XRP stay: the base reserve cannot leave the account, and the owner
      // reserve of the line is what the next run would set again. Nothing else is held.
      try {
        await client.disconnect();
      } catch {}
      return { lines, txs };
    },
  };
}
