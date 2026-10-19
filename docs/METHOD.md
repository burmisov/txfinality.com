# Method v0 (draft, 2026-10-18)

a. A wallet of ours sends 0.1 USDC (USDT where the chain has only USDT; the first Solana run, on
   2026-10-18, sent 1 USDC — the amount is in every run file and has no bearing on the time) to a second wallet of
   ours, one the runner derives from the first wallet's key and never stores. Nothing else is in the transaction beyond what makes it land and tells it apart: on Solana, a
   memo naming the run and a small priority fee.
b. The clock starts the instant before the signed transaction leaves our machine. The machine and the
   RPC provider are named in every run: both are part of the number. No simulation or preflight is run
   before sending; a transfer that cannot land is recorded as failed. If no level has seen the transfer
   after 20 s, the same signed bytes are sent again (an RPC can accept a transaction and lose it; seen
   on BNB Chain through Infura on 2026-10-19), as a wallet would; the clock is not touched, so the
   figure includes the wait, and the run file says how many times each transfer was resent.
c. The transaction is polled on the chain's own RPC until it reaches each level the chain defines: first
   in a block, the earliest level the chain calls safe (*done* on the page), the level it calls final
   (*final*). The chain's own names for its levels are kept and printed. A level's time is the moment
   the poll that first showed it came back, so a figure carries up to one poll interval (100 ms by
   default, recorded in the run, with the number of polls each transfer took) plus one RPC round trip of slack. Figures are never smaller than the
   truth. Once the only levels still to come are ones the chain's docs put at a minute or more (a
   rollup's batch reaching Ethereum, say), the poll slows to 2 s by default: those figures carry up to
   2 s of slack instead, which the run file records (`slowPollMs`, `slowLevels`).
d. Twenty transfers per chain per run, one at a time: a transfer is sent alone and watched until it is
   final (or fails, or its cap passes) before the next one is built, except as rule k says. Nothing else
   runs meanwhile. One run a week. The page shows the slowest of the twenty; the run file has all of
   them, with hashes.
e. Each chain's own claim is quoted from its documentation beside the link, with the date it was read and
   the date it will be read again.
f. The method is versioned. A run records the version it was made under; the page shows the latest
   version's runs and links the older.
g. Setup and teardown are not timed. Before the first transfer the runner creates what transfers need
   (the recipient's token account, say); after the last it sends the asset back to the first wallet,
   closes what it created and reclaims the rent. Their transaction ids are in the run file too.

h. By design: a chain is listed with its documented figures and not measured when even the earliest level
   it stands behind takes a minute or more (Ethereum: an epoch; Bitcoin: a block; Tron: solidified). Chains whose first safe level comes
   in seconds are measured, however long their last level takes — the rollups included.
i. Until a chain is measured, the page shows the seconds its own docs give, marked ≈, with the quote beside
   them. Where the docs give no number, the page shows ?.

j. A chain may be listed outside the cut by decision, when it is new and built for stablecoins (Arc), or
   because everyone asks (Bitcoin); the landscape file says so.

Open: whether the first level ("first in a block") is shown on the page or only kept in the run file;
the cap per chain run (30 min in the code); what to do with a transfer that fails to land (recorded as
`failed`, excluded from nothing: the page shows *?* when any of the twenty lacks a level).
k. Where the final level is documented at a minute or more (a rollup's L1 finality), the next transfer is
   sent as soon as the previous one has reached its *done* level, and the long waits overlap: each
   transfer's quick phase still happens alone, each transfer keeps its own clock, and a run takes one
   L1 finality plus twenty done-times rather than twenty L1 finalities. The run file names the gate
   level (`overlapAfter`); null means strictly serial. Levels the docs give no number for can be
   declared slow for a run (`--slow`); the run file lists them (`slowLevels`). Added 2026-10-19.
