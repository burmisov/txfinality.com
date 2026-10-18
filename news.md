# Changes

## 2026-10-18 — the project starts

The premise, the page design (six mocks), the structure and the method draft are in `docs/`. Nothing
is measured yet.

## 2026-10-18 — mocks 7 and 8

The byline above the list; *done* emphasised when it is fast while *final* is not; the column words link
to their questions; everything below the list is a question that expands; a link to a chain opens and
highlights its row.

## 2026-10-18 — the first run: Solana

Twenty transfers of 1 USDC, one at a time, from runner-1 through Infura:
`runs/solana/2026-10-18T2118Z.json`. Slowest *confirmed* 1.105 s, slowest *finalized* 8.075 s; the twenty
finalized between 7.164 s and 8.075 s. Method v0. The runner holds one key, makes its recipient from it,
and returned the 20 USDC and the account rent afterwards; those transactions are in the run file too.
