# Method v0 (draft, 2026-10-18)

a. A wallet of ours sends 10 USDC (USDT where USDC is not native on the chain) to a second wallet of
   ours. Nothing else is in the transaction beyond what makes it land and tells it apart: on Solana, a
   memo naming the run and a small priority fee.
b. The clock starts the instant before the signed transaction leaves our machine. The machine and the
   RPC provider are named in every run: both are part of the number. No simulation or preflight is run
   before sending; a transfer that cannot land is recorded as failed.
c. The transaction is polled on the chain's own RPC until it reaches each level the chain defines: first
   in a block, the earliest level the chain calls safe (*done* on the page), the level it calls final
   (*final*). The chain's own names for its levels are kept and printed. A level's time is the moment
   the poll that first showed it came back, so a figure carries up to one poll interval (250 ms by
   default, recorded in the run) plus one RPC round trip of slack. Figures are never smaller than the
   truth.
d. Twenty transfers per chain per run, sent one per second and polled together; one run a week. The page
   shows the slowest of the twenty; the run file has all of them, with hashes.
e. Each chain's own claim is quoted from its documentation beside the link, with the date it was read and
   the date it will be read again.
f. The method is versioned. A run records the version it was made under; the page shows the latest
   version's runs and links the older.
g. One-time setup is not timed: creating the recipient's token account, say, happens before the first
   transfer of a run.

Open: whether the first level ("first in a block") is shown on the page or only kept in the run file;
the cap per chain run (30 min in the code); what to do with a transfer that fails to land (recorded as
`failed`, excluded from nothing: the page shows *?* when any of the twenty lacks a level).
