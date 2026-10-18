# Robinhood Chain — what the docs say

Read 2026-10-18. Quotes are verbatim from the page named; nothing here is paraphrased. Re-read monthly (see `claim.next_read` in `chains/robinhood.yaml`).

## Pages

- https://docs.robinhood.com/chain
- https://docs.robinhood.com/chain/transaction-finality
- https://docs.robinhood.com/chain/connecting
- https://docs.robinhood.com/chain/contracts

## Quotes

- “The sequencer has committed to your transaction's inclusion and ordering.”
  — https://docs.robinhood.com/chain/transaction-finality (Soft confirmation, “Sub-second”)
- “The sequencer batches transactions and posts the batch to the Ethereum (L1) Inbox.”
  — https://docs.robinhood.com/chain/transaction-finality (Posted to Ethereum, “Minutes”)
- “Full finality — your transaction inherits Ethereum's security and is irreversible.”
  — https://docs.robinhood.com/chain/transaction-finality (Ethereum finality, “~13 minutes after posting”)
- “Robinhood Chain is an Arbitrum Layer-2 Chain built on Ethereum.”
  — https://docs.robinhood.com/chain/connecting

## Notes and gaps

- Chain id 4663; RPC https://rpc.mainnet.chain.robinhood.com (rate-limited, "not recommended for production"); sequencer feed wss://feed.mainnet.chain.robinhood.com.
- Not on Circle's list; the contracts page lists WETH and USDG only. USDG 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168 from that page.
- Block time: docs give no number. safe/finalized tags: not mentioned by Robinhood; as an Arbitrum Nitro chain the Arbitrum reference applies.
