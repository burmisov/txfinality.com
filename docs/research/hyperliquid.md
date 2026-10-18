# Hyperliquid (HyperEVM) — what the docs say

Read 2026-10-18. Quotes are verbatim from the page named; nothing here is paraphrased. Re-read monthly (see `claim.next_read` in `chains/hyperliquid.yaml`).

## Pages

- https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm
- https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm/dual-block-architecture
- https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm/json-rpc
- https://developers.circle.com/stablecoins/usdc-contract-addresses

## Quotes

- “The HyperEVM consists of EVM blocks built as part of Hyperliquid's execution, inheriting all security from HyperBFT consensus.”
  — https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm
- “Fast block duration is set to 1 seconds with a 3M gas limit. Slow block duration is set to 1 minute with a 30M gas limit.”
  — https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm/dual-block-architecture
- “This data is written after committed blocks are verified by the node, and therefore has no additional trust assumptions compared to running the EVM RPC directly from the node itself.”
  — https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm/raw-hyperevm-block-data

## Notes and gaps

- Chain id 999; RPC https://rpc.hyperliquid.xyz/evm; no websocket.
- No page defines final or gives a finality time; safe/finalized tags are not documented. Circle calls the chain HyperEVM.
