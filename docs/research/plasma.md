# Plasma — what the docs say

Read 2026-10-18. Quotes are verbatim from the page named; nothing here is paraphrased. Re-read monthly (see `claim.next_read` in `chains/plasma.yaml`).

## Pages

- https://www.plasma.org/docs/plasma-chain/architecture/consensus
- https://www.plasma.org/docs/plasma-chain/network-information/connect-to-plasma
- https://www.plasma.org/docs/plasma-chain/network-information/differences-ethereum-and-plasma
- https://developers.circle.com/stablecoins/usdc-contract-addresses

## Quotes

- “Plasma is secured by PlasmaBFT, a high-performance implementation of Fast HotStuff written in Rust.”
  — https://www.plasma.org/docs/plasma-chain/architecture/consensus
- “Block finality is achieved in seconds with minimal communication overhead, and validator selection is driven by a simplified Proof of Stake system optimized for performance and predictable behavior.”
  — https://www.plasma.org/docs/plasma-chain/architecture/consensus
- “In the common case, blocks can be finalized after two consecutive QCs. A third phase is avoided unless needed, reducing round latency.”
  — https://www.plasma.org/docs/plasma-chain/architecture/consensus
- “The Proof of Stake and Committee Formation mechanism are under active development. This page outlines the intended architecture but is subject to change.”
  — https://www.plasma.org/docs/plasma-chain/architecture/consensus

## Notes and gaps

- Chain id 9745; RPC https://rpc.plasma.to (rate-limited).
- Not documented: block interval, any finality number, safe/finalized block tags. Verify the tags on the RPC before a run.
- USDT0 address not on the docs pages read nor on Tether's page; Circle's native USDC is used.
