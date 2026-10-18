# Tron — what the docs say

Read 2026-10-18. Quotes are verbatim from the page named; nothing here is paraphrased. Re-read monthly (see `claim.next_read` in `chains/tron.yaml`).

## Pages

- https://developers.tron.network/docs/concensus (the slug is misspelled on the real URL)
- https://developers.tron.network/docs/confirmation-semantics
- https://developers.tron.network/docs/tron-protocol-transaction
- https://tronprotocol.github.io/documentation-en/mechanism-algorithm/dpos/
- https://tether.to/en/supported-protocols (USDT TRC-20 address)

## Quotes

- “Twenty-seven Super Representatives (SRs) , elected by stakers' votes, take turns producing blocks every 3 seconds.”
  — https://developers.tron.network/docs/concensus
- “Blocks become irreversible — solidified — once at least 19 distinct active SRs have each produced a block at that height or above, typically in about 1 minute.”
  — https://developers.tron.network/docs/concensus
- “The solid height only moves forward and never rolls back, which is why exchanges and wallets generally treat "block solidified" as the point of final settlement.”
  — https://developers.tron.network/docs/concensus
- “Therefore, a block is solidified when 18 subsequent blocks are produced by 18 different SRs (plus the original block producer, totaling 19 distinct SR confirmations).”
  — https://tronprotocol.github.io/documentation-en/mechanism-algorithm/dpos/
- “To confirm solidified inclusion, use /walletsolidity/gettransactionbyid to query the transaction body from solidified state.”
  — https://developers.tron.network/docs/confirmation-semantics
- “/walletsolidity endpoints read state at the latest solidified block and usually lag the latest head by about 1 minute.”
  — https://developers.tron.network/docs/confirmation-semantics

## Notes and gaps

- Levels: broadcast result (not inclusion) → in a block on the FullNode ("pending") → solidified ("fully confirmed", "final on-chain"). Worst case for solidification: "No fixed upper bound."
- Detection: head = wallet/gettransactioninfobyid returns a receipt; solid = walletsolidity/gettransactioninfobyid returns the same id.
- Not on Circle's USDC list; USDT TRC-20 from Tether's page.
- Not verified from an official page: the TronGrid mainnet base URL (api.trongrid.io); the field semantics of receipt.result.
