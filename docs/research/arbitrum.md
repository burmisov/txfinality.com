# Arbitrum One — what the docs say

Read 2026-10-18. Quotes are verbatim from the page named; nothing here is paraphrased. Re-read monthly (see `claim.next_read` in `chains/arbitrum.yaml`).

## Pages

- https://docs.arbitrum.io/how-arbitrum-works/deep-dives/finality
- https://docs.arbitrum.io/how-arbitrum-works/reference/finality-and-reorgs
- https://docs.arbitrum.io/how-arbitrum-works/deep-dives/sequencer
- https://docs.arbitrum.io/build-decentralized-apps/reference/node-providers
- https://developers.circle.com/stablecoins/usdc-contract-addresses

## Quotes

- “On Arbitrum One, `B` is 250ms and `K` is 2, so each round lasts 125ms.”
  — https://docs.arbitrum.io/how-arbitrum-works/deep-dives/sequencer
- “Soft finality: Provided by the Sequencer's real-time feed, offering immediate but provisional transaction confirmations.”
  — https://docs.arbitrum.io/how-arbitrum-works/deep-dives/finality
- “Parent-chain data finality (batch posted and finalized on L1) | Transaction data is durably recorded and inherits the parent chain's consensus security | ~2 epochs, roughly 12–15 minutes (the batch poster defaults to referencing the L1 `safe` block)”
  — https://docs.arbitrum.io/how-arbitrum-works/deep-dives/finality
- “Hard finality—the `safe` and `finalized` tags—is inherited from the parent chain and is what makes a block reorg-proof.”
  — https://docs.arbitrum.io/how-arbitrum-works/reference/finality-and-reorgs
- “The `safe` and `finalized` tags are always available on Arbitrum One and Nova.”
  — https://docs.arbitrum.io/how-arbitrum-works/reference/finality-and-reorgs
- “`finalized` is roughly two epochs (~64 slots, ~13 minutes) behind the head”
  — https://docs.arbitrum.io/how-arbitrum-works/reference/finality-and-reorgs

## Notes and gaps

- Chain id 42161; RPC https://arb1.arbitrum.io/rpc ("No uptime, latency, or rate-limit guarantees.").
- A third stage, full settlement (assertion confirmed), is "on the order of days"; it is a withdrawal matter, not a transfer's finality, and is not a level here.
- Not verified: batch-posting cadence; arb_ method names.
