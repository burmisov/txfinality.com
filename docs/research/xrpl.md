# XRP Ledger — what the docs say

Read 2026-10-18. Quotes are verbatim from the page named; nothing here is paraphrased. Re-read monthly (see `claim.next_read` in `chains/xrpl.yaml`).

## Pages

- https://xrpl.org/docs/concepts/consensus-protocol/consensus-structure
- https://xrpl.org/docs/concepts/transactions/finality-of-results
- https://xrpl.org/docs/concepts/ledgers/open-closed-validated-ledgers
- https://xrpl.org/docs/concepts/consensus-protocol/consensus-principles-and-rules
- https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/transaction-methods/tx
- https://xrpl.org/docs/tutorials/public-servers
- https://developers.circle.com/stablecoins/usdc-contract-addresses (USDC issuer)

## Quotes

- “The XRP Ledger has a new ledger version every several seconds.”
  — https://xrpl.org/docs/concepts/consensus-protocol/consensus-structure
- “The XRP Ledger's technology enables near real-time settlement (three to six seconds)...”
  — https://xrpl.org/docs/concepts/consensus-protocol/consensus-principles-and-rules
- “When the network agrees on the contents of a ledger version, that ledger version is validated , and its contents can never change.”
  — https://xrpl.org/docs/concepts/consensus-protocol/consensus-structure
- “The only way to know with certainty that a transaction finally succeeded is to check the status of the transaction until it is both in a validated ledger and has result code tesSUCCESS .”
  — https://xrpl.org/docs/concepts/consensus-protocol/consensus-structure
- “A server has one open ledger, any number of closed but unvalidated ledgers, and an immutable history of validated ledgers.”
  — https://xrpl.org/docs/concepts/ledgers/open-closed-validated-ledgers
- “If `true`, this data comes from a validated ledger version; if omitted or set to `false`, this data is not final.”
  — https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/transaction-methods/tx

## Notes and gaps

- Levels: open (tentative) → closed, unvalidated → validated (final). The docs give no per-level seconds; overall “three to six seconds”.
- Detection: `tx` with `validated: true` and `meta.TransactionResult == tesSUCCESS`; a `txnNotFound` alone proves nothing until LastLedgerSequence has passed.
- Native USDC on XRPL: currency USDC (hex 5553444300000000000000000000000000000000), issuer rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE (Circle's list).
- Public servers from the docs: https://s1.ripple.com:51234/, https://xrplcluster.com/.
