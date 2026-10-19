// EVM chains, one driver for all of them. One transfer = one ERC-20 `transfer` of the asset to the
// derived recipient. Levels come from the chain file's `detect` strings, so the same code serves
// BNB Chain, Polygon, Avalanche, the rollups and the rest:
//
//   receipt                the transaction has a receipt (it is in a block); a reverted one has failed
//   block tag safe         the RPC's `safe` block is at or past the transfer's block
//   block tag finalized    the RPC's `finalized` block is at or past the transfer's block
//   confirmations N        the latest block is N-1 or more blocks past the transfer's block
//
// One key serves every EVM chain: the sender is the same address everywhere. The recipient is
// derived from the key (sha256 with a tag, as a private key), never stored. Setup gives it a little
// gas; teardown sends the asset and the leftover gas back. All of that is outside the clock.
import { createHash } from "node:crypto";

import {
  type Address,
  type Chain as ViemChain,
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  formatEther,
  formatUnits,
  type Hex,
  http,
  keccak256,
  parseAbiItem,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import type { Chain } from "../chain.ts";
import type { Driver, Signed, Status } from "../driver.ts";
import { need } from "../env.ts";

type Detect = { kind: "receipt" } | { kind: "tag"; tag: "safe" | "finalized" } | { kind: "confirmations"; n: number };

export function parseDetect(s: string): Detect {
  const t = s.trim();
  if (t === "receipt") return { kind: "receipt" };
  const tag = /^block tag (safe|finalized)$/.exec(t);
  if (tag) return { kind: "tag", tag: tag[1] as "safe" | "finalized" };
  const conf = /^confirmations (\d+)$/.exec(t);
  if (conf) return { kind: "confirmations", n: Number(conf[1]) };
  throw new Error(`evm: unknown detect "${s}" (receipt | block tag safe | block tag finalized | confirmations N)`);
}

export function recipientKeyOf(senderKey: Hex): Hex {
  const seed = createHash("sha256").update("txfinality recipient v0").update(Buffer.from(senderKey.slice(2), "hex")).digest();
  return `0x${seed.toString("hex")}`;
}

const asKey = (s: string): Hex => (s.startsWith("0x") ? s : `0x${s}`) as Hex;

/** The fee caps for a transaction: what the node suggests as a gas price is the floor and the
 *  priority fee is never above it. On a chain with no base fee (BNB Chain), the library's
 *  estimate is the node's legacy default tip (1 gwei) while the suggested price is 0.05 gwei:
 *  twenty times what lands, which emptied a sender on 2026-10-19. */
export function feeCaps(gasPrice: bigint, baseFee: bigint, priority: bigint): { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint } {
  const maxPriorityFeePerGas = priority < gasPrice ? priority : gasPrice;
  const byBase = baseFee * 2n + maxPriorityFeePerGas;
  return { maxFeePerGas: byBase > gasPrice ? byBase : gasPrice, maxPriorityFeePerGas };
}

export function evm(chain: Chain): Driver {
  const url = need(chain.rpc.env);
  const chainId = Number(chain.chainId ?? 0);
  if (!chainId) throw new Error(`chains/${chain.id}.yaml needs chainId for the evm driver`);
  const viemChain: ViemChain = {
    id: chainId,
    name: chain.name,
    nativeCurrency: { name: "gas", symbol: "GAS", decimals: 18 },
    rpcUrls: { default: { http: [url] } },
  };
  const client: PublicClient = createPublicClient({ chain: viemChain, transport: http(url) });
  const token = chain.asset.contract as Address;
  // On a chain whose gas IS the asset (Arc: USDC), the recipient's token balance is also what pays
  // its fees, so the return is a sweep of the native balance rather than a token transfer.
  const assetIsGas = chain.asset.gas === true;
  const detects = chain.levels.map((l) => parseDetect(l.detect));
  if (detects[0]?.kind !== "receipt") throw new Error(`chains/${chain.id}.yaml: the first evm level must be "receipt"`);

  let sender: ReturnType<typeof privateKeyToAccount> | undefined;
  let recipient: ReturnType<typeof privateKeyToAccount> | undefined;
  let decimals = -1;
  let amount = 0n;
  const keys = () => {
    if (!sender) {
      const k = asKey(need(chain.wallets.from_env));
      sender = privateKeyToAccount(k);
      recipient = privateKeyToAccount(recipientKeyOf(k));
    }
    if (!recipient) throw new Error("unreachable");
    return { sender, recipient };
  };
  const units = async (): Promise<void> => {
    if (decimals < 0) {
      decimals = await client.readContract({ address: token, abi: erc20Abi, functionName: "decimals" });
      amount = BigInt(Math.round(Number(chain.asset.amount) * 10 ** decimals));
    }
  };
  const balanceOf = (who: Address): Promise<bigint> =>
    client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [who] });

  const fees = async (): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> => {
    const [gasPrice, block, priority] = await Promise.all([
      client.getGasPrice(),
      client.getBlock({ blockTag: "latest" }),
      client.estimateMaxPriorityFeePerGas().catch(() => 0n),
    ]);
    return feeCaps(gasPrice, block.baseFeePerGas ?? 0n, priority);
  };
  /** Signs a transaction from `from` with everything fetched now, so sending is one call. */
  const sign = async (
    from: ReturnType<typeof privateKeyToAccount>,
    tx: { to: Address; data?: Hex; value?: bigint; gas?: bigint },
    /** the balance the fee must fit in: a return from the recipient, whose gas is what setup gave it */
    within?: bigint,
  ): Promise<Signed> => {
    const [nonce, caps] = await Promise.all([
      client.getTransactionCount({ address: from.address, blockTag: "pending" }),
      fees(),
    ]);
    // an estimate gets headroom; a gas figure the caller states (a plain value transfer) is exact
    const gas = tx.gas ?? ((await client.estimateGas({ account: from.address, to: tx.to, data: tx.data, value: tx.value })) * 12n) / 10n;
    // Nodes behind one endpoint can quote different prices (BNB Chain through Infura: 0.05 gwei
    // and 1 gwei within a minute). The recipient was funded at one quote and may be asked to pay
    // at another; a return that cannot be afforded at the quote goes out at what it can afford.
    if (within !== undefined && caps.maxFeePerGas * gas > within - (tx.value ?? 0n)) {
      caps.maxFeePerGas = (within - (tx.value ?? 0n)) / gas;
      if (caps.maxPriorityFeePerGas > caps.maxFeePerGas) caps.maxPriorityFeePerGas = caps.maxFeePerGas;
    }
    const raw = await from.signTransaction({
      chainId,
      nonce,
      to: tx.to,
      data: tx.data,
      value: tx.value ?? 0n,
      gas,
      maxFeePerGas: caps.maxFeePerGas,
      maxPriorityFeePerGas: caps.maxPriorityFeePerGas,
      type: "eip1559",
    });
    return { id: keccak256(raw), raw: Buffer.from(raw.slice(2), "hex") };
  };
  const sendAndWait = async (signed: Signed): Promise<Hex> => {
    const hash = await client.sendRawTransaction({ serializedTransaction: `0x${Buffer.from(signed.raw).toString("hex")}` });
    const r = await client.waitForTransactionReceipt({ hash, pollingInterval: 500 });
    if (r.status !== "success") throw new Error(`${hash} reverted`);
    return hash;
  };
  const transferData = (to: Address, value: bigint): Hex =>
    encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [to, value] });

  // per-poll cache of the chain's safe/finalized/latest heads, so n transfers cost n+3 calls at most
  const receipts = new Map<string, { block: bigint; ok: boolean }>();

  return {
    levels: chain.levels.map((l) => l.name),

    get wallets() {
      const { sender, recipient } = keys();
      return { from: sender.address, to: recipient.address };
    },

    async setup() {
      const { sender, recipient } = keys();
      await units();
      const lines: string[] = [];
      const txs: string[] = [];
      const [gas, have, rGas] = await Promise.all([
        client.getBalance({ address: sender.address }),
        balanceOf(sender.address),
        client.getBalance({ address: recipient.address }),
      ]);
      lines.push(`sender    ${sender.address}  ${formatEther(gas)} gas  ${formatUnits(have, decimals)} ${chain.asset.symbol}`);
      lines.push(`recipient ${recipient.address}  (derived from the sender's key)  ${formatEther(rGas)} gas`);
      if (have < amount) throw new Error(`the sender holds ${formatUnits(have, decimals)} ${chain.asset.symbol}; fund it first`);
      // The recipient needs gas to send the asset back in teardown: a token transfer plus the sweep,
      // with headroom. Topped up once, before the clock; whatever is left comes back after.
      const needGas = (await fees()).maxFeePerGas * 200_000n;
      if (rGas < needGas) {
        const signed = await sign(sender, { to: recipient.address, value: needGas * 2n - rGas });
        txs.push(await sendAndWait(signed));
        lines.push(`gave the recipient gas for the return (not timed): ${txs[txs.length - 1]}`);
      }
      return { lines, txs };
    },

    async prepare(): Promise<Signed> {
      const { sender, recipient } = keys();
      await units();
      return sign(sender, { to: token, data: transferData(recipient.address, amount) });
    },

    async send(signed) {
      await client.sendRawTransaction({ serializedTransaction: `0x${Buffer.from(signed.raw).toString("hex")}` });
    },

    async status(ids) {
      const out = new Map<string, Status>();
      const heads = new Map<string, bigint>();
      const head = async (tag: "safe" | "finalized" | "latest"): Promise<bigint> => {
        let n = heads.get(tag);
        if (n === undefined) {
          n = (await client.getBlock({ blockTag: tag })).number ?? 0n;
          heads.set(tag, n);
        }
        return n;
      };
      for (const id of ids) {
        let r = receipts.get(id);
        if (!r) {
          try {
            const got = await client.getTransactionReceipt({ hash: id as Hex });
            r = { block: got.blockNumber, ok: got.status === "success" };
            receipts.set(id, r);
          } catch {
            out.set(id, { level: null });
            continue;
          }
        }
        if (!r.ok) {
          out.set(id, { level: chain.levels[0]?.name ?? "receipt", failed: "reverted" });
          continue;
        }
        let level = chain.levels[0]?.name ?? null;
        for (let i = 1; i < detects.length; i++) {
          const d = detects[i];
          const name = chain.levels[i]?.name;
          if (!d || !name) break;
          let reached = false;
          if (d.kind === "tag") reached = (await head(d.tag)) >= r.block;
          else if (d.kind === "confirmations") reached = (await head("latest")) - r.block + 1n >= BigInt(d.n);
          if (!reached) break;
          level = name;
        }
        out.set(id, { level });
      }
      return out;
    },

    async teardown() {
      const { sender, recipient } = keys();
      await units();
      const lines: string[] = [];
      const txs: string[] = [];
      const held = assetIsGas ? 0n : await balanceOf(recipient.address);
      if (held > 0n) {
        // The price may have risen since setup funded the recipient (Arbitrum: tenfold within an
        // hour). If what it holds cannot pay for the return and the sweep, the sender tops it up.
        const data = transferData(sender.address, held);
        const [have, caps, est] = await Promise.all([
          client.getBalance({ address: recipient.address }),
          fees(),
          client.estimateGas({ account: recipient.address, to: token, data }),
        ]);
        const needed = caps.maxFeePerGas * ((est * 12n) / 10n + 21_000n);
        if (have < needed) {
          const topUp = await sign(sender, { to: recipient.address, value: needed * 2n - have });
          txs.push(await sendAndWait(topUp));
          lines.push(`gave the recipient gas for the return, the price having risen: ${txs[txs.length - 1]}`);
        }
        const signed = await sign(recipient, { to: token, data }, await client.getBalance({ address: recipient.address }));
        txs.push(await sendAndWait(signed));
        lines.push(`returned ${formatUnits(held, decimals)} ${chain.asset.symbol}: ${txs[txs.length - 1]}`);
      }
      // The sweep: a plain transfer is not 21,000 gas everywhere (Arbitrum adds the L1 share to the
      // limit), and a rollup charges an L1 data fee on top of gas × price (Base), so the estimate is
      // asked for and twice the cost is left behind. The dust is far below a cent.
      const gasLeft = await client.getBalance({ address: recipient.address });
      const sweepGas = gasLeft > 0n ? ((await client.estimateGas({ account: recipient.address, to: sender.address, value: 1n })) * 12n) / 10n : 21_000n;
      const cost = (await fees()).maxFeePerGas * sweepGas;
      if (gasLeft > cost * 3n) {
        const value = gasLeft - cost * 2n;
        // priced within what is left, so a second, higher quote cannot make the sweep unaffordable
        const signed = await sign(recipient, { to: sender.address, value, gas: sweepGas }, gasLeft);
        txs.push(await sendAndWait(signed));
        lines.push(`returned ${formatEther(value)} gas: ${txs[txs.length - 1]}`);
      } else if (held === 0n) {
        lines.push("the recipient holds nothing to return");
      }
      if (assetIsGas && gasLeft > cost * 3n) lines[lines.length - 1] = `returned ${formatEther(gasLeft - cost * 2n)} ${chain.asset.symbol} (the asset is the gas): ${txs[txs.length - 1]}`;
      return { lines, txs };
    },

    async recent(limit) {
      // Transfers of the asset in the newest block: they have a receipt and nothing more yet.
      const latest = await client.getBlockNumber();
      const logs = await client.getLogs({
        address: token,
        event: parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)"),
        fromBlock: latest,
        toBlock: latest,
      });
      return [...new Set(logs.map((l) => l.transactionHash))].slice(0, limit);
    },
  };
}
