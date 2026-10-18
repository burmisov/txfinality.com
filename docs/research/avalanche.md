# Avalanche C-Chain — what the docs say

Read 2026-10-18. Quotes are verbatim from the page named; nothing here is paraphrased. Re-read monthly (see `claim.next_read` in `chains/avalanche.yaml`).

## Pages

- https://build.avax.network/docs/primary-network/avalanche-consensus
- https://build.avax.network/docs/rpcs/c-chain
- https://developers.circle.com/stablecoins/usdc-contract-addresses

## Quotes

- “Avalanche is very performant. It can process thousands of transactions per second with ~1 second acceptance latency.”
  — https://build.avax.network/docs/primary-network/avalanche-consensus
- “In Avalanche, acceptance/rejection are final and irreversible and only take a few seconds.”
  — https://build.avax.network/docs/primary-network/avalanche-consensus
- “Speed: Snowman Consensus provides sub-second, immutable finality, ensuring that transactions are quickly confirmed and irreversible.”
  — https://build.avax.network/docs/primary-network/avalanche-consensus
- “safe and finalized are the last settled block, the most recent block whose execution results are included in an accepted block.”
  — https://build.avax.network/docs/rpcs/c-chain
- “State and receipt reads wait for an accepted block to execute.”
  — https://build.avax.network/docs/rpcs/c-chain

## Notes and gaps

- Chain id 43114; RPC https://api.avax.network/ext/bc/C/rpc.
- The consensus page says sub-second, ~1 second and a few seconds on the same page; all three are verbatim. No block interval is stated.
