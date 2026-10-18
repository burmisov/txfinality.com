# Polygon PoS — what the docs say

Read 2026-10-18. Quotes are verbatim from the page named; nothing here is paraphrased. Re-read monthly (see `claim.next_read` in `chains/polygon.yaml`).

## Pages

- https://docs.polygon.technology/pos/concepts/finality/finality
- https://docs.polygon.technology/pos/architecture/heimdall_v2/milestones
- https://docs.polygon.technology/pos/architecture/heimdall_v2/checkpoints
- https://docs.polygon.technology/pos/reference/rpc-endpoints
- https://developers.circle.com/stablecoins/usdc-contract-addresses

## Quotes

- “Polygon Chain uses deterministic finality via its milestone mechanism.”
  — https://docs.polygon.technology/pos/concepts/finality/finality
- “Milestones typically finalize a transaction within 2 to 5 seconds.”
  — https://docs.polygon.technology/pos/concepts/finality/finality
- “Once 2/3+ of the network agrees, the milestone is finalized, and all transactions up to that milestone are considered final, with no chance of reorganization.”
  — https://docs.polygon.technology/pos/architecture/heimdall_v2/milestones
- “Use the standard eth_getBlockByNumber JSON-RPC method with the "finalized" block tag to retrieve the most recently finalized block on Polygon Chain. Finalized blocks are considered irreversible.”
  — https://docs.polygon.technology/pos/concepts/finality/finality
- “Checkpoints are separate from milestones. A transaction is finalized on Polygon by a milestone well before the next checkpoint is submitted.”
  — https://docs.polygon.technology/pos/concepts/finality/finality

## Notes and gaps

- Chain id 137; the docs list only third-party public RPCs (https://polygon.drpc.org, https://polygon.publicnode.com …).
- The Bor (EVM) block interval is not stated numerically on the pages read; "1 to 2 second block times" refers to Heimdall. The `safe` tag is not mentioned.
