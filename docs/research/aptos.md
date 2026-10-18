# Aptos — what the docs say

Read 2026-10-18. Quotes are verbatim from the page named; nothing here is paraphrased. Re-read monthly (see `claim.next_read` in `chains/aptos.yaml`).

## Pages

- https://aptos.dev/build/guides/payments (section “Latency, block time, and fees”)
- https://aptos.dev/network/glossary
- https://aptos.dev/network/blockchain/txns-states
- https://aptos.dev/build/apis/fullnode-rest-api
- https://api.mainnet.aptoslabs.com/v1/spec.json
- https://developers.circle.com/stablecoins/usdc-contract-addresses

## Quotes

- “Mainnet block times are typically tens of milliseconds.”
  — https://aptos.dev/build/guides/payments
- “A successful payment is final as soon as the transaction commits (BFT consensus, no extra block confirmations).”
  — https://aptos.dev/build/guides/payments
- “Aptos uses BFT consensus, so a transaction is final as soon as it commits.”
  — https://aptos.dev/network/glossary
- “A committed transaction is final, whether it succeeded or aborted.”
  — https://aptos.dev/build/guides/payments
- “End-to-end (E2E) latency Client submit → committed and returned by waitForTransaction Typically sub-second under normal load.”
  — https://aptos.dev/build/guides/payments
- “When given a transaction hash, the server first looks for the transaction in storage (on-chain, committed). If no on-chain transaction is found, it looks the transaction up by hash in the mempool (pending, not yet committed).”
  — https://api.mainnet.aptoslabs.com/v1/spec.json

## Notes and gaps

- Levels: pending (mempool) → committed (final). No separate finalized notion.
- Detection: GET /transactions/by_hash/{hash} answers type user_transaction (committed) or pending_transaction; success: true for a successful one.
- Mainnet REST base: https://api.mainnet.aptoslabs.com/v1.
