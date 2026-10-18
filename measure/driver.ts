// What a chain driver has to provide. The runner does the clock, the pacing and the file;
// a driver knows how to build, send and watch one chain's transfers. Everything else about
// the chain is data in `chains/<id>.yaml`.

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

export interface Driver {
  /** Level names in order, the last one being final. Must equal the chain file's list. */
  readonly levels: readonly string[];
  /** Checks balances, creates what a transfer needs (a token account, say). Returns lines to print. */
  setup(): Promise<string[]>;
  /** Builds and signs transfer `i` of `n`. Each transfer must be distinct on chain; `tag` helps. */
  prepare(i: number, n: number, tag: string): Promise<Signed>;
  /** Sends the bytes. The runner reads the clock immediately before calling this. */
  send(signed: Signed): Promise<void>;
  /** The current level of each id, in one round trip where the chain allows it. */
  status(ids: readonly string[]): Promise<Map<string, Status>>;
  /** Optional: ids of other people's transfers of the same asset seen at an early level just now.
   *  `txfinality watch` uses it to exercise level detection without sending anything. */
  recent?(limit: number): Promise<string[]>;
}
