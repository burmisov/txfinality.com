# Ethereum — what the docs say

Read 2026-10-18. Quotes are verbatim from the page named; nothing here is paraphrased. Re-read monthly (see `claim.next_read` in `chains/ethereum.yaml`).

## Pages

- https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/ (section “Finality”)
- https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/gasper/
- https://ethereum.org/en/developers/docs/blocks/
- https://ethereum.org/en/developers/docs/apis/json-rpc/
- https://github.com/ethereum/execution-apis/blob/main/src/schemas/block.yaml (BlockTag)
- https://developers.circle.com/stablecoins/usdc-contract-addresses

## Quotes

- “Time in proof-of-stake Ethereum is divided into slots (12 seconds) and epochs (32 slots).”
  — https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/
- “The first block in each epoch is a checkpoint. Validators vote for pairs of checkpoints that it considers to be valid. If a pair of checkpoints attracts votes representing at least two-thirds of the total staked ETH, the checkpoints are upgraded. The more recent of the two (target) becomes "justified". The earlier of the two is already justified because it was the "target" in the previous epoch. Now it is upgraded to "finalized".”
  — https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/
- “Once a block is finalized, it cannot be reverted or changed without a majority slashing of stakers, making it economically inviable.”
  — https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/
- “`finalized`: The most recent crypto-economically secure block, cannot be re-orged outside of manual intervention driven by community coordination; `safe`: The most recent block that is safe from re-orgs under honest majority and certain synchronicity assumptions; `latest`: The most recent block in the canonical chain observed by the client, this block may be re-orged out of the canonical chain even under healthy/normal conditions”
  — https://github.com/ethereum/execution-apis/blob/main/src/schemas/block.yaml

## Notes and gaps

- Neither ethereum.org nor the execution-apis spec states a time for `safe` or `finalized`, nor the phrases "two epochs", "6.4" or "12.8" minutes. The seconds in the chain file are derived from 12-second slots and 32-slot epochs and are marked so.
