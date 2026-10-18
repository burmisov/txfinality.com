# X Layer — what the docs say

Read 2026-10-18. Quotes are verbatim from the page named; nothing here is paraphrased. Re-read monthly (see `claim.next_read` in `chains/xlayer.yaml`).

## Pages

- https://web3.okx.com/xlayer/docs/developer/build-on-xlayer/quickstart (a single-page app; every path serves the same shell)
- https://developers.circle.com/stablecoins/usdc-contract-addresses

## Quotes

- “X Layer has evolved to adopt the Optimism Stack (OP Stack) framework”
  — https://web3.okx.com/xlayer/docs/developer/build-on-xlayer/quickstart
- “Fast execution happens on L2 with 1-second block times.”
  — https://web3.okx.com/xlayer/docs/developer/build-on-xlayer/quickstart
- “After L1 verification, withdrawals and messages achieve L1 finality (PP is verified).”
  — https://web3.okx.com/xlayer/docs/developer/build-on-xlayer/quickstart
- “All L2 data is published to L1, ensuring the system is fully trustless and censorship-resistant.”
  — https://web3.okx.com/xlayer/docs/developer/build-on-xlayer/quickstart

## Notes and gaps

- The docs define neither unsafe/safe/finalized nor the older trusted/virtual/consolidated levels; the chain is op-node + op-reth, so the OP Stack tags are assumed and must be verified on the RPC before a run.
- Chain id 196 is corroborated only by the docs app's embedded token list, not by a docs sentence. No public RPC URL found on a reachable page.
- Circle notes a separate bridged USDC.e on X Layer that it does not issue; the address above is Circle's native USDC.
