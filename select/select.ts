// The landscape: which chains hold the most dollars today, and so which ones the page measures.
// Reads DeFiLlama's list of chains by stablecoin supply (the ranking) and CoinGecko's market caps
// (a second signal), both keyless, and writes `landscape/<date>.json`. Nothing here is a figure of
// ours; `docs/SOURCES.md` has the sources, their terms and how they are credited.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { parse } from "yaml";

import { root } from "../measure/root.ts";

export const CUT = 15;
const KEEP = 25;

/** DeFiLlama's name for a chain → our id and its coin on CoinGecko (null: no coin, or none we trust). */
export const KNOWN: Record<string, { id: string; coin: string | null }> = {
  Ethereum: { id: "ethereum", coin: "ethereum" },
  Tron: { id: "tron", coin: "tron" },
  Solana: { id: "solana", coin: "solana" },
  BSC: { id: "bnb", coin: "binancecoin" },
  "Hyperliquid L1": { id: "hyperliquid", coin: "hyperliquid" },
  Base: { id: "base", coin: null },
  Arbitrum: { id: "arbitrum", coin: "arbitrum" },
  Polygon: { id: "polygon", coin: "polygon-ecosystem-token" },
  "X Layer": { id: "xlayer", coin: "okb" },
  Avalanche: { id: "avalanche", coin: "avalanche-2" },
  Plasma: { id: "plasma", coin: "plasma" },
  XRPL: { id: "xrpl", coin: "ripple" },
  "Robinhood Chain": { id: "robinhood", coin: null },
  Aptos: { id: "aptos", coin: "aptos" },
  TON: { id: "ton", coin: "the-open-network" },
  Tempo: { id: "tempo", coin: null },
  Monad: { id: "monad", coin: "monad" },
  Arc: { id: "arc", coin: null },
  "OP Mainnet": { id: "optimism", coin: "optimism" },
  Stellar: { id: "stellar", coin: "stellar" },
  Mantle: { id: "mantle", coin: "mantle" },
  Sui: { id: "sui", coin: "sui" },
  Bitcoin: { id: "bitcoin", coin: "bitcoin" },
};

/** Listed whatever the ranking says: Bitcoin because everyone asks, Arc because it is new and built
 *  for stablecoins (his decision, 2026-10-18). Method v0, rule j. */
export const ALWAYS = ["Bitcoin", "Arc"];
/** Parked by decision (method rule l): in the cut by supply, but off the page for now; the chain file says why. */
export const PARKED = ["Aptos"];

export type Entry = {
  rank: number | null;
  name: string;
  id: string;
  stablecoinsUsd: number;
  marketCapUsd: number | null;
  inside: boolean;
  /** on the page: inside the cut, or listed by decision (ALWAYS) */
  listed: boolean;
  /** from chains/<id>.yaml, or "no chain file" */
  status: string;
};

export type Landscape = {
  date: string;
  readAt: string;
  method: string;
  cut: number;
  sources: { ranking: string; marketCap: string; credit: string[] };
  chains: Entry[];
};

type LlamaChain = { name: string; totalCirculatingUSD: Record<string, number> };
type GeckoCoin = { id: string; market_cap: number | null };

export function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function statusOf(id: string): string {
  const file = join(root, "chains", `${id}.yaml`);
  if (!existsSync(file)) return "no chain file";
  const y = parse(readFileSync(file, "utf8")) as { status?: string };
  return y.status ?? "no status";
}

/** Pure: the landscape from the two sources' answers. */
export function landscape(llama: LlamaChain[], gecko: GeckoCoin[], readAt: Date): Landscape {
  const caps = new Map(gecko.map((c) => [c.id, c.market_cap]));
  const ranked = llama
    .map((c) => ({ name: c.name, usd: Object.values(c.totalCirculatingUSD).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.usd - a.usd);
  const entries: Entry[] = [];
  ranked.slice(0, KEEP).forEach((c, i) => {
    const known = KNOWN[c.name];
    const id = known?.id ?? slug(c.name);
    const coin = known?.coin ?? null;
    entries.push({
      rank: i + 1,
      name: c.name,
      id,
      stablecoinsUsd: Math.round(c.usd),
      marketCapUsd: coin === null ? null : (caps.get(coin) ?? null),
      inside: i < CUT,
      listed: (i < CUT || ALWAYS.includes(c.name)) && !PARKED.includes(c.name),
      status: statusOf(id),
    });
  });
  for (const name of ALWAYS) {
    if (entries.some((e) => e.name === name)) continue;
    const known = KNOWN[name];
    const id = known?.id ?? slug(name);
    const found = ranked.find((c) => c.name === name);
    entries.push({
      rank: found ? ranked.indexOf(found) + 1 : null,
      name,
      id,
      stablecoinsUsd: Math.round(found?.usd ?? 0),
      marketCapUsd: known?.coin ? (caps.get(known.coin) ?? null) : null,
      inside: false,
      listed: true,
      status: statusOf(id),
    });
  }
  return {
    date: readAt.toISOString().slice(0, 10),
    readAt: readAt.toISOString(),
    method: "v0",
    cut: CUT,
    sources: {
      ranking: "https://stablecoins.llama.fi/stablecoinchains",
      marketCap: "https://api.coingecko.com/api/v3/coins/markets",
      credit: ["Chain ranking by stablecoin supply: DefiLlama", "Market caps: Powered by CoinGecko"],
    },
    chains: entries,
  };
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json", "user-agent": "txfinality.com select (github.com/burmisov/txfinality.com)" } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function select(): Promise<{ file: string; landscape: Landscape }> {
  const readAt = new Date();
  const llama = await getJson<LlamaChain[]>("https://stablecoins.llama.fi/stablecoinchains");
  const coins = [...new Set(Object.values(KNOWN).map((k) => k.coin).filter((c): c is string => c !== null))];
  const gecko = await getJson<GeckoCoin[]>(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=250&ids=${coins.join(",")}`,
  );
  const l = landscape(llama, gecko, readAt);
  const file = join(root, "landscape", `${l.date}.json`);
  writeFileSync(file, `${JSON.stringify(l, null, 2)}\n`);
  return { file, landscape: l };
}

export function describe(l: Landscape): string[] {
  const bn = (n: number | null): string => (n === null ? "—" : `$${(n / 1e9).toFixed(2)} bn`);
  return l.chains.map(
    (c) =>
      `${String(c.rank ?? "·").padStart(3)} ${c.inside ? "in " : c.listed ? "+  " : "   "} ${c.name.padEnd(16)} ${bn(c.stablecoinsUsd).padStart(11)}  ${bn(c.marketCapUsd).padStart(11)}  ${c.status}`,
  );
}
