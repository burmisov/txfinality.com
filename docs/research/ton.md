# TON — what the docs say

Read 2026-10-18. Quotes are verbatim from the page named; nothing here is paraphrased. Re-read monthly (see `claim.next_read` in `chains/ton.yaml`).

## Pages

- https://docs.ton.org/v3/guidelines/dapps/asset-processing/payments-processing (section “Transaction finality”)
- https://docs.ton.org/v3/concepts/dive-into-ton/ton-blockchain/blockchain-of-blockchains
- https://docs.ton.org/api/overview
- https://tether.to/en/supported-protocols (USDT jetton master)

## Quotes

- “TON achieves transaction finality after a single masterchain block confirmation, typically within 1 second.”
  — https://docs.ton.org/v3/guidelines/dapps/asset-processing/payments-processing
- “Once a transaction from a shardchain appears in a masterchain block, it becomes irreversible.”
  — https://docs.ton.org/v3/guidelines/dapps/asset-processing/payments-processing
- “When monitoring payments, you need to verify that the transaction was included in a masterchain block rather than just in a shardchain.”
  — https://docs.ton.org/v3/guidelines/dapps/asset-processing/payments-processing
- “Most TON APIs provide methods to check whether a transaction has achieved masterchain finality or, better yet, only consider a transaction included in the masterchain as finalized by the network.”
  — https://docs.ton.org/v3/guidelines/dapps/asset-processing/payments-processing
- “Typically, the process takes below a second to reach transaction finality, a time to mint a new block.”
  — https://docs.ton.org/v3/concepts/dive-into-ton/ton-blockchain/blockchain-of-blockchains

## Notes and gaps

- The masterchain produces blocks "approximately every 400 milliseconds" (payments-processing page, sentence partly truncated in our read).
- Endpoints from docs.ton.org/api/overview: TON Center v2 https://toncenter.com/api/v2, v3 https://toncenter.com/api/v3; TON Center is named the official HTTP API provider.
- Not verified: the exact TON Center method and field for masterchain inclusion (openapi.json answered HTTP 500); the shardchain block interval.
- Not on Circle's USDC list; USDT from Tether's page.
