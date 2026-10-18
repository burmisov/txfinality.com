// What a chain driver has to provide. The runner does the clock and the file; a driver knows how
// to prepare the ground, build, send and watch one chain's transfers, and tidy up after. Everything
// else about the chain is data in `chains/<id>.yaml`.

export type Signed = {
  /** The chain's own identifier for the transfer: a signature on Solana, a hash on EVM chains. */
  id: string;
  /** The bytes that go out. Signed before the clock starts. */
  raw: Uint8Array;
};

export type Status = {
  /** The highest level the chain reports for this id right now, in the chain file's words; null if unseen. */
  level: string | null;
  /** Set when the chain says the transfer landed and failed. The transfer is then over. */
  failed?: string;
};

export type Lines = string[];

export interface Driver {
  /** Level names in order, the last one being final. Must equal the chain file's list. */
  readonly levels: readonly string[];
  /** The sender's address and the recipient's, for the run file. */
  readonly wallets: { from: string; to: string };
  /** Before the first transfer, not timed: checks balances, creates what transfers need (token
   *  accounts, say). Returns lines to print and the ids of any transactions it sent. */
  setup(): Promise<{ lines: Lines; txs: string[] }>;
  /** Builds and signs transfer `i` of `n`. Each transfer must be distinct on chain; `tag` helps. */
  prepare(i: number, n: number, tag: string): Promise<Signed>;
  /** Sends the bytes. The runner reads the clock immediately before calling this. */
  send(signed: Signed): Promise<void>;
  /** The current level of each id, in one round trip where the chain allows it. */
  status(ids: readonly string[]): Promise<Map<string, Status>>;
  /** After the last transfer, not timed: returns the asset to the sender, closes what setup
   *  created, reclaims what can be reclaimed. Safe to call on its own after an interrupted run. */
  teardown(): Promise<{ lines: Lines; txs: string[] }>;
  /** Optional: ids of other people's transfers of the same asset seen at an early level just now.
   *  `txfinality watch` uses it to exercise level detection without sending anything. */
  recent?(limit: number): Promise<string[]>;
}
