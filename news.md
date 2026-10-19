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

## 2026-10-19 — Arc, Hyperliquid, BNB Chain; a tenth of a dollar from now on

Three more chains measured through Infura, twenty transfers each, one at a time:
`runs/arc/2026-10-19T1048Z.json` (slowest *final* 1.346 s; there is only the one level, and USDC is the
gas), `runs/hyperliquid/2026-10-19T1048Z.json` (slowest *in a block* 2.773 s; the one level HyperEVM names),
`runs/bnb/2026-10-19T1055Z.json` (slowest *in a block* 1.939 s, slowest *fast finality* 2.742 s, in USDT).
The amount per transfer is 0.1 from now on (method rule a): a run needs about two dollars and some gas,
which is what the funds allow across fifteen chains and what anyone can spare to check a figure.

Three things the runner learned today, all in the method or the run files: a level the docs put at a minute
or more is polled every 2 s rather than every 100 ms (rule c); a transfer no level has seen after 20 s is
sent again, unchanged, and the run says so (rule b — BNB Chain's RPC accepted one and lost it); and the
first BNB Chain run ran its sender out of gas because the library's fee estimate was twenty times the
chain's price, so fees now start from the price the node suggests. The BNB run's return of funds failed
inside the run (two nodes behind the endpoint quoted prices twenty times apart within a minute) and was
done by hand afterwards; the run file records the failure.
