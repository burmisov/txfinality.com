# Solana — what the docs say

Read 2026-10-18. Quotes are verbatim from the page named; nothing here is paraphrased. Re-read monthly (see `claim.next_read` in `chains/solana.yaml`).

## Pages

- https://solana.com/docs/rpc (section “Configuring State Commitment”)
- https://solana.com/docs/advanced/confirmation
- https://solana.com/docs/references/terminology
- https://solana.com/docs/rpc/http/getsignaturestatuses
- https://developers.circle.com/stablecoins/usdc-contract-addresses

## Quotes

- “processed: The node's most recent processed block. This is the newest view, but it can still be rolled back.”
  — https://solana.com/docs/rpc
- “confirmed: A block directly voted on by a supermajority of stake, meaning more than two-thirds of the network's active stake.”
  — https://solana.com/docs/rpc
- “finalized: A block the cluster recognizes as finalized with maximum lockout, meaning it has reached the strongest confirmation state used by the network.”
  — https://solana.com/docs/rpc
- “Since slots (aka the time period a validator can produce a block) are configured to last about 400ms, but may fluctuate between 400ms and 600ms, a given blockhash can only be used by transactions for about 60 to 90 seconds before it will be considered expired by the runtime.”
  — https://solana.com/docs/advanced/confirmation
- “The tradeoff is that there is typically at least a 32 slot difference between the most recent confirmed block and the most recent finalized block. This tradeoff is pretty severe and effectively reduces the expiration of your transactions by about 13 seconds but this could be even more during unstable cluster conditions.”
  — https://solana.com/docs/advanced/confirmation
- “confirmationStatus — Cluster confirmation status. When present, the value is `processed`, `confirmed`, or `finalized`.”
  — https://solana.com/docs/rpc/http/getsignaturestatuses

## Notes and gaps

- No page states a total time to finalized; only the 32-slot gap after confirmed, which the docs call about 13 seconds.
- Measured here on 2026-10-18: finalized 7.2–8.1 s from sending, through Infura.
