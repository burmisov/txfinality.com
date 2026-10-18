# Base — what the docs say

Read 2026-10-18. Quotes are verbatim from the page named; nothing here is paraphrased. Re-read monthly (see `claim.next_read` in `chains/base.yaml`).

## Pages

- https://docs.base.org/specifications/transactions/transaction-finality
- https://docs.base.org/specifications/flashblocks
- https://docs.base.org/base-chain/flashblocks/apps
- https://docs.base.org/base-chain/quickstart/connecting-to-base
- https://docs.optimism.io/stack/transactions/transaction-finality (OP Stack, applies to Base)
- https://developers.circle.com/stablecoins/usdc-contract-addresses

## Quotes

- “After roughly 200ms, the transaction is included in a preconfirmation block (Flashblock) by the Base sequencer.”
  — https://docs.base.org/specifications/transactions/transaction-finality
- “After roughly 2 seconds, the sequencer has built the transaction into an L2 block.”
  — https://docs.base.org/specifications/transactions/transaction-finality
- “After roughly 2 minutes, a Base batch containing the transaction has been posted to Ethereum.”
  — https://docs.base.org/specifications/transactions/transaction-finality
- “The Ethereum L1 batch containing the transaction is older than 2 epochs, or 64 L1 blocks.”
  — https://docs.base.org/specifications/transactions/transaction-finality (step “L1 Batch Finality: ~20m”)
- “The unsafe head is served as the `latest` block, and the safe and finalized heads back the `safe` and `finalized` block tags.”
  — https://docs.optimism.io/stack/transactions/transaction-finality
- “The public Base endpoints are **HTTP only**.”
  — https://docs.base.org/base-chain/flashblocks/apps

## Notes and gaps

- Chain id 8453; RPC https://mainnet.base.org; https://mainnet-sequencer.base.org only to send.
- Flashblocks (200 ms) are read through the `pending` block tag on Flashblocks-enabled endpoints; our runner polls receipts, so its first level is the 2-second block.
