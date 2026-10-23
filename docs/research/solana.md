# Solana — what the docs say

Read 2026-10-18; re-read 2026-10-23 after Alpenglow (below). Quotes are verbatim from the page named; nothing here is paraphrased. Re-read monthly (see `claim.next_read` in `chains/solana.yaml`).

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

## Re-read 2026-10-23: Alpenglow

Alpenglow replaced TowerBFT on mainnet at epoch 1064 (2026-10-21); the cluster answered `solana-core` 4.3.2
on 2026-10-23.

- “Under Alpenglow, the Confirmed and Finalized commitment statuses are equivalent: both mean that a transaction has been permanently committed to the ledger and cannot be rolled back.”
  — https://docs.anza.xyz/consensus/commitments
- Its table gives, for both: “60%+ stake voted finalize or 80%+ stake voted notarize on block”; under TowerBFT, finalized was “31+ confirmed blocks built atop block”.
  — https://docs.anza.xyz/consensus/commitments

- https://solana.com/docs/rpc still carried the TowerBFT definitions above on 2026-10-23 (“finalized with maximum lockout”), with no Alpenglow note; the chain file now quotes Anza's page.
- `getSignatureStatuses` is unchanged and still reports `confirmationStatus`; the runner needed no change.
- Measured here on 2026-10-23: confirmed and finalized on the same poll in all twenty transfers, 0.663–0.884 s from sending, through Infura (`runs/solana/2026-10-23T0634Z.json`).
- Not established here: the “150 ms” finality Anza and the Foundation give as a target. That time starts at a block; ours starts before the send and includes landing in a block and our 100 ms polling.

