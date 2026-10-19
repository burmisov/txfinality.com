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

## 2026-10-19 — Avalanche

`runs/avalanche/2026-10-19T1151Z.json`: twenty transfers of 0.1 USDC through Infura; slowest *accepted*
4.884 s, slowest *settled* (the RPC's finalized tag) 10.958 s, the twenty settling between 6.772 s and
10.958 s. Two runs before it did not complete and are not kept: one node behind the endpoint handed back a
used nonce (the runner now counts nonces itself), and the sender ran out of AVAX at the nineteenth transfer
(a run needs about 0.015 AVAX at the node's fee ceiling, which is what is now sent).

## 2026-10-19 — Polygon PoS

`runs/polygon/2026-10-19T1434Z.json`: twenty transfers of 0.1 USDC through Infura; slowest *in a block*
2.216 s, slowest *milestone* (the RPC's finalized tag; the node refuses `safe`) 6.913 s, the twenty
reaching a milestone between 3.691 s and 6.913 s. The smoke run before it measured the same but could not
return its gas: a node behind the endpoint reported the recipient's balance before the return it had just
paid for, and the sweep overshot by exactly that fee — balances are now read only from a node whose
transaction count has caught up with ours.

## 2026-10-19 — Plasma

`runs/plasma/2026-10-19T1456Z.json`: twenty transfers of 0.1 USDC through a Chainstack node (its free
plan allows 25 requests a second, so this run polled every 200 ms rather than 100: `pollMs` says so);
slowest *in a block* 1.066 s, slowest *finalized* (the RPC's finalized tag, two blocks behind the head)
2.93 s, the twenty finalizing between 2.657 s and 2.93 s.

## 2026-10-19 — Arbitrum, and method rule k

`runs/arbitrum/2026-10-19T1519Z.json`: twenty transfers of 0.1 USDC; slowest *in a block* 0.743 s, slowest
*posted to L1* (the RPC's safe tag) 337.63 s, slowest *L1 finalized* 1100.443 s, the twenty finalizing
between 1087.838 s and 1100.443 s. This is the first run under rule k: the next transfer went out once the
previous one was in a block, so all twenty were sent within thirteen seconds and the run took nineteen
minutes rather than six hours; the slow levels were polled every 10 s (`slowPollMs`). Reads came from
dRPC and sends went to Arbitrum's own endpoint (`rpc.send_env`). Two earlier serial runs of the day were
stopped by decision at transfer eleven and are not kept.

## 2026-10-19 — X Layer

`runs/xlayer/2026-10-19T1526Z.json`: twenty transfers of 0.1 USDC under rule k; slowest *in a block*
3.941 s, slowest *posted to L1* (the RPC's safe tag) 195.232 s, slowest *L1 finalized* 1140.447 s, the twenty
finalizing between 1098.619 s and 1140.447 s. The chain file gained the *posted to L1* level today (the
RPC serves the OP Stack tags). A first attempt through a third-party node alone never got its transaction
to the sequencer; sends now go to the chain's own endpoint (`rpc.send_env`) while reads stay on dRPC.

## 2026-10-19 — Robinhood Chain

`runs/robinhood/2026-10-19T1538Z.json`: twenty transfers of 0.1 USDG under rule k; slowest *in a block*
0.843 s, slowest *posted to L1* (the RPC's safe tag) 747.856 s, slowest *L1 finalized* 1128.202 s, the
twenty finalizing between 1112.424 s and 1128.202 s. A one-transfer smoke earlier in the day posted in
541 s and finalized in 929 s; the batch to Ethereum comes when it comes.

## 2026-10-19 — Base; eleven measured

`runs/base/2026-10-19T1559Z.json`: twenty transfers of 0.1 USDC under rule k; slowest *in a block*
1.295 s, slowest *posted to L1* (the RPC's safe tag) 46.58 s, slowest *L1 finalized* 1279.094 s, the twenty
finalizing between 1264.285 s and 1279.094 s. Reads for this run came from Infura: a free third-party
node refused the polling rate at the thirteenth transfer twice (the run file records the host it used).
Eleven of the fifteen are measured now; the four left are Ethereum and Tron (by design), TON, XRPL and
Aptos (drivers to write).

## 2026-10-19 — TON, the first non-EVM chain after Solana

`runs/ton/2026-10-19T1658Z.json`: twenty transfers of 0.1 USDT (the jetton), one at a time, polled every
200 ms through TON Center with a key; slowest *in a shardchain block* 2.335 s, slowest *in a masterchain
block* 2.335 s, the twenty between 1.051 s and 2.335 s. What is timed is the credit: the transaction on
the recipient's jetton wallet, three hops after the sender's external message (sender wallet, sender
jetton wallet, recipient jetton wallet). In sixteen of the twenty the shard and masterchain levels were
first seen in the same poll. A first attempt died at its first transfer when the API answered with an
empty body; the driver retries such answers now. The TON and the USDT were returned to the sender.

## 2026-10-19 — XRP Ledger; thirteen measured

`runs/xrpl/2026-10-19T1701Z.json`: twenty Payments of 0.1 USDC (Circle's issued currency), one at a time,
polled every 200 ms through xrplcluster.com; slowest *validated* 13.291 s, median 5.38 s, quickest 3.436 s.
The recipient's trust line and reserve XRP were set up before the clock and stay for the next run; the
USDC came back. Thirteen of the fifteen are measured; Aptos waits for funds, Ethereum and Tron are by
design.
