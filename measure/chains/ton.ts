// TON. One transfer = one external message from the sender's wallet carrying a jetton `transfer`
// of the asset (USDT) to the recipient. The thing timed is the credit: the transaction on the
// recipient's jetton wallet that carries the `internal_transfer` with our query id — first seen in
// a shardchain block (the liteserver's view of the account, API v2), then referenced by a
// masterchain block (API v3, which indexes from masterchain blocks and so lists a transaction only
// once a masterchain block has sealed its shard block).
//
// Only the sender's seed is held. The recipient is derived from it (sha256 of the seed with a tag,
// used as a seed), a plain wallet of the same contract. Setup gives the recipient TON for the
// return; teardown sends the jettons back and then the TON, both outside the clock.
//
// `TON_API_URL` is the base of a TON Center-compatible API (`https://toncenter.com`, or a provider's
// base that carries the key in its path); `TON_API_KEY` is TON Center's own header, when there is one.
import { createHash } from "node:crypto";

import { Address, beginCell, type Cell, internal, SendMode, toNano } from "@ton/core";
import { keyPairFromSeed, type KeyPair } from "@ton/crypto";
import { TonClient, WalletContractV4 } from "@ton/ton";

import type { Chain } from "../chain.ts";
import type { Driver, Signed, Status } from "../driver.ts";
import { maybe, need } from "../env.ts";

const OP_TRANSFER = 0x0f8a7ea5;
const OP_INTERNAL_TRANSFER = 0x178d4519;
/** TON attached to a jetton transfer; what the wallets do not spend comes back to the sender. */
const TRANSFER_GAS = toNano("0.05");
/** What the recipient gets for its return (one jetton transfer and one plain transfer). */
const RECIPIENT_GAS = toNano("0.15");

/** The seed as `txfinality wallet` writes it: 32 bytes, hex. */
export function keyPairFrom(secret: string): KeyPair {
  const hex = secret.trim().replace(/^0x/, "");
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error("TON_FROM_KEY must be a 32-byte seed in hex");
  return keyPairFromSeed(Buffer.from(hex, "hex"));
}

/** The recipient that belongs to a sender: derived, never stored. */
export function recipientSeedOf(senderSeedHex: string): Buffer {
  return createHash("sha256").update("txfinality recipient v0").update(Buffer.from(senderSeedHex.trim().replace(/^0x/, ""), "hex")).digest();
}

/** A query id that names the transfer: the first 8 bytes of the tag's hash. */
export function queryIdOf(tag: string): bigint {
  return createHash("sha256").update(tag).digest().readBigUInt64BE(0);
}

/** The op and query id at the head of a message body, if it has one. */
export function opAndQuery(body: Cell): { op: number; queryId: bigint } | null {
  try {
    const s = body.beginParse();
    if (s.remainingBits < 96) return null;
    return { op: s.loadUint(32), queryId: s.loadUintBig(64) };
  } catch {
    return null;
  }
}

export function ton(chain: Chain): Driver {
  const base = need(chain.rpc.env).replace(/\/$/, "");
  const apiKey = maybe("TON_API_KEY");
  const client = new TonClient({ endpoint: `${base}/api/v2/jsonRPC`, ...(apiKey ? { apiKey } : {}) });
  const master = Address.parse(chain.asset.contract);
  const detects = chain.levels.map((l) => l.detect);
  if (chain.levels.length !== 2) throw new Error(`chains/${chain.id}.yaml: the ton driver expects two levels (shard, masterchain)`);

  let sender: KeyPair | undefined;
  let recipient: KeyPair | undefined;
  let decimals = -1;
  let amount = 0n;
  let senderJetton: Address | undefined;
  let recipientJetton: Address | undefined;
  /** transfer id → its query id, and the credit transaction once seen */
  const queries = new Map<string, bigint>();
  const credits = new Map<string, { lt: bigint; hash: string }>();

  const keys = () => {
    sender ??= keyPairFrom(need(chain.wallets.from_env));
    recipient ??= keyPairFromSeed(recipientSeedOf(need(chain.wallets.from_env)));
    const from = WalletContractV4.create({ workchain: 0, publicKey: sender.publicKey });
    const to = WalletContractV4.create({ workchain: 0, publicKey: recipient.publicKey });
    return { sender, recipient, from, to };
  };
  const v3 = async <T>(path: string): Promise<T> => {
    const r = await fetch(`${base}/api/v3/${path}`, { headers: { accept: "application/json", ...(apiKey ? { "X-API-Key": apiKey } : {}) } });
    if (!r.ok) throw new Error(`TON API v3 ${path.split("?")[0]}: HTTP ${r.status} ${(await r.text()).slice(0, 120)}`);
    return (await r.json()) as T;
  };
  const jettonWalletOf = async (owner: Address): Promise<Address> => {
    const r = await client.runMethod(master, "get_wallet_address", [{ type: "slice", cell: beginCell().storeAddress(owner).endCell() }]);
    return r.stack.readAddress();
  };
  const units = async (): Promise<void> => {
    if (decimals < 0) {
      const d = await v3<{ jetton_masters: { jetton_content?: { decimals?: string | number } }[] }>(`jetton/masters?address=${master.toString()}&limit=1`);
      const dec = d.jetton_masters[0]?.jetton_content?.decimals;
      decimals = dec === undefined ? 6 : Number(dec);
      amount = BigInt(Math.round(Number(chain.asset.amount) * 10 ** decimals));
      const { from, to } = keys();
      senderJetton = await jettonWalletOf(from.address);
      recipientJetton = await jettonWalletOf(to.address);
    }
  };
  const jettonBalance = async (wallet: Address): Promise<bigint> => {
    try {
      const r = await client.runMethod(wallet, "get_wallet_data", []);
      return r.stack.readBigNumber();
    } catch {
      return 0n; // not deployed yet: nothing held
    }
  };
  const transferBody = (queryId: bigint, jettons: bigint, to: Address, responseTo: Address): Cell =>
    beginCell()
      .storeUint(OP_TRANSFER, 32)
      .storeUint(queryId, 64)
      .storeCoins(jettons)
      .storeAddress(to)
      .storeAddress(responseTo)
      .storeMaybeRef(null)
      .storeCoins(0n)
      .storeBit(0)
      .endCell();
  const sendBoc = async (boc: Buffer): Promise<string> => {
    const r = await fetch(`${base}/api/v2/sendBocReturnHash`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", ...(apiKey ? { "X-API-Key": apiKey } : {}) },
      body: JSON.stringify({ boc: boc.toString("base64") }),
    });
    const d = (await r.json()) as { ok: boolean; result?: { hash: string }; error?: string };
    if (!d.ok || !d.result) throw new Error(`sendBoc: ${d.error ?? `HTTP ${r.status}`}`);
    return Buffer.from(d.result.hash, "base64").toString("hex");
  };
  /** Sends from a wallet and waits for its seqno to move on (setup and teardown only). */
  const sendAndWait = async (wallet: WalletContractV4, key: KeyPair, messages: ReturnType<typeof internal>[], mode = SendMode.PAY_GAS_SEPARATELY): Promise<string> => {
    const opened = client.open(wallet);
    const seqno = await opened.getSeqno();
    const transfer = wallet.createTransfer({ seqno, secretKey: key.secretKey, messages, sendMode: mode });
    const init = seqno === 0 ? { code: wallet.init.code, data: wallet.init.data } : undefined;
    const ext = beginCell()
      .storeUint(0b10, 2)
      .storeUint(0, 2)
      .storeAddress(wallet.address)
      .storeCoins(0n)
      .storeBit(init !== undefined)
      .storeBit(init !== undefined ? 1 : 0);
    if (init) ext.storeRef(beginCell().storeUint(0, 2).storeBit(1).storeRef(init.code).storeBit(1).storeRef(init.data).storeUint(0, 1).endCell());
    ext.storeBit(1).storeRef(transfer);
    const hash = await sendBoc(ext.endCell().toBoc());
    const until = Date.now() + 3 * 60_000;
    for (;;) {
      await new Promise((res) => setTimeout(res, 1500));
      if ((await opened.getSeqno()) > seqno) return hash;
      if (Date.now() > until) throw new Error(`${hash} not applied after 3 minutes; check it before running again`);
    }
  };
  const fmt = (u: bigint): string => (Number(u) / 10 ** decimals).toString();
  const ton = (n: bigint): string => (Number(n) / 1e9).toString();

  return {
    levels: chain.levels.map((l) => l.name),

    get wallets() {
      const { from, to } = keys();
      return { from: from.address.toString({ bounceable: false }), to: to.address.toString({ bounceable: false }) };
    },

    async setup() {
      const { from, to, sender } = keys();
      await units();
      const lines: string[] = [];
      const txs: string[] = [];
      const [gas, have, rGas] = await Promise.all([client.getBalance(from.address), jettonBalance(senderJetton as Address), client.getBalance(to.address)]);
      lines.push(`sender    ${from.address.toString({ bounceable: false })}  ${ton(gas)} TON  ${fmt(have)} ${chain.asset.symbol}`);
      lines.push(`recipient ${to.address.toString({ bounceable: false })}  (derived from the sender's seed)  ${ton(rGas)} TON`);
      if (have < amount) throw new Error(`the sender holds ${fmt(have)} ${chain.asset.symbol}; fund it first`);
      if (rGas < RECIPIENT_GAS) {
        txs.push(await sendAndWait(from, sender, [internal({ to: to.address, value: RECIPIENT_GAS - rGas, bounce: false })]));
        lines.push(`gave the recipient TON for the return (not timed): ${txs[txs.length - 1]}`);
      }
      return { lines, txs };
    },

    async prepare(_i, _n, tag): Promise<Signed> {
      const { from, to, sender } = keys();
      await units();
      const seqno = await client.open(from).getSeqno();
      const queryId = queryIdOf(tag);
      const body = transferBody(queryId, amount, to.address, from.address);
      const transfer = from.createTransfer({
        seqno,
        secretKey: sender.secretKey,
        messages: [internal({ to: senderJetton as Address, value: TRANSFER_GAS, bounce: true, body })],
        sendMode: SendMode.PAY_GAS_SEPARATELY,
      });
      const ext = beginCell().storeUint(0b10, 2).storeUint(0, 2).storeAddress(from.address).storeCoins(0n).storeBit(0).storeBit(1).storeRef(transfer).endCell();
      const id = ext.hash().toString("hex");
      queries.set(id, queryId);
      return { id, raw: ext.toBoc() };
    },

    async send(signed) {
      await sendBoc(Buffer.from(signed.raw));
    },

    async status(ids) {
      const out = new Map<string, Status>();
      const rj = recipientJetton as Address;
      const [shard, masterchain] = chain.levels.map((l) => l.name) as [string, string];
      // one read of the recipient's jetton wallet serves every transfer not yet seen in a shard block
      let recent: Awaited<ReturnType<typeof client.getTransactions>> | undefined;
      let indexed: Set<string> | undefined;
      for (const id of ids) {
        const queryId = queries.get(id);
        if (queryId === undefined) {
          out.set(id, { level: null });
          continue;
        }
        let credit = credits.get(id);
        if (!credit) {
          recent ??= await client.getTransactions(rj, { limit: 20 }).catch(() => []);
          for (const t of recent) {
            const body = t.inMessage?.body;
            const head = body ? opAndQuery(body) : null;
            if (head && head.op === OP_INTERNAL_TRANSFER && head.queryId === queryId) {
              credit = { lt: t.lt, hash: t.hash().toString("base64") };
              credits.set(id, credit);
              break;
            }
          }
        }
        if (!credit) {
          out.set(id, { level: null });
          continue;
        }
        indexed ??= new Set(
          (await v3<{ transactions: { hash: string }[] }>(`transactions?account=${rj.toString()}&limit=20&sort=desc`).catch(() => ({ transactions: [] }))).transactions.map((t) => t.hash),
        );
        out.set(id, { level: indexed.has(credit.hash) ? masterchain : shard });
      }
      void detects;
      return out;
    },

    async teardown() {
      const { from, to, recipient } = keys();
      await units();
      const lines: string[] = [];
      const txs: string[] = [];
      const held = await jettonBalance(recipientJetton as Address);
      if (held > 0n) {
        const body = transferBody(queryIdOf(`return ${Date.now()}`), held, from.address, from.address);
        txs.push(await sendAndWait(to, recipient, [internal({ to: recipientJetton as Address, value: TRANSFER_GAS, bounce: true, body })]));
        lines.push(`returned ${fmt(held)} ${chain.asset.symbol}: ${txs[txs.length - 1]}`);
      }
      const left = await client.getBalance(to.address);
      if (left > toNano("0.02")) {
        txs.push(await sendAndWait(to, recipient, [internal({ to: from.address, value: 0n, bounce: false })], SendMode.CARRY_ALL_REMAINING_BALANCE));
        lines.push(`returned the recipient's TON: ${txs[txs.length - 1]}`);
      } else if (held === 0n) {
        lines.push("the recipient holds nothing to return");
      }
      return { lines, txs };
    },
  };
}
