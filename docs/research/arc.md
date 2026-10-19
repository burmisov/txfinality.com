# Arc — what the docs say

Read 2026-10-18. Quotes are verbatim from the page named; nothing here is paraphrased. Re-read monthly (see `claim.next_read` in `chains/arc.yaml`).

## Pages

- https://docs.arc.io/arc/concepts/deterministic-finality
- https://docs.arc.io/integrate/wallets/transaction-lifecycle
- https://docs.arc.io/arc/concepts/consensus-layer
- https://docs.arc.network/arc/references/connect-to-arc (chain id, RPC)
- https://developers.circle.com/stablecoins/usdc-contract-addresses (USDC on Arc)

## Quotes

- “Arc provides deterministic finality: every transaction is either unconfirmed or final, with no intermediate state.”
  — https://docs.arc.io/arc/concepts/deterministic-finality
- “Arc uses a two-state transaction model. A transaction is either **pending** (in the mempool) or **final** (included in a committed block). There is no intermediate "confirming" state and no concept of accumulating confirmations.”
  — https://docs.arc.io/integrate/wallets/transaction-lifecycle
- “Pending | Mempool | Not final | Sub-second (typical)” / “Final | Committed block | Irreversible | Permanent”
  — https://docs.arc.io/integrate/wallets/transaction-lifecycle (table)
- “Arc | <1 s | Deterministic. Final on commit.”
  — https://docs.arc.io/arc/concepts/deterministic-finality (finality comparison table)
- “Arc's Malachite consensus layer orders, validates, and finalizes blocks using a Tendermint-based Proof-of-Authority model.”
  — https://docs.arc.io/arc/concepts/consensus-layer

## Notes and gaps

- Chain id 5042; RPC https://rpc.mainnet.arc.io; USDC is the native gas token with 18 decimals; the USDC address on Circle's list is 0x3600000000000000000000000000000000000000 (a system contract; verify it answers the ERC-20 interface before a run).
- No block interval is stated; finality is "in under one second".
- Listed by decision (2026-10-18) although below the cut: rank 18, $0.67 bn that day.
