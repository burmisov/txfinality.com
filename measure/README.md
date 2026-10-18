# measure/ — the runner

TypeScript on Node 22.6+ (types are stripped at start; nothing is compiled). No framework.

```
bin.js          `npx txfinality …` lands here and re-launches node with type stripping on
cli.ts          the four commands: measure, watch, wallet, return
run.ts          the clock, one transfer at a time to final, the polling, setup and teardown, the run file
driver.ts       what a chain driver provides: setup, prepare, send, status, teardown — and optionally recent
chain.ts        reads chains/<id>.yaml, checks it, hashes it
env.ts          .env loading (repository first, then ~/.config/txfinality/.env); the host of an RPC URL
chains/
  solana.ts     the Solana driver: transferChecked + memo + a small priority fee; levels from
                getSignatureStatuses: processed, confirmed, finalized; the recipient derived from the
                sender's key; its token account created in setup, emptied and closed in teardown
```

```sh
npm run typecheck
npm test
npx txfinality watch   --chain solana              # read-only: times live transfers from first sight
npx txfinality wallet  --chain solana              # a sender into .env (mode 0600); prints its address
npx txfinality measure --chain solana --runs 20 [--poll-ms 100] [--cap-minutes 30] [--machine "runner-1"]
npx txfinality return  --chain solana              # the teardown alone, after an interrupted run
```

How a figure is made: one transfer at a time. The signed bytes are built first; the clock starts the
instant before they are sent; the transfer is polled alone, one request per interval, until it is final;
a level's time is when the poll that first showed it came back; only then is the next one built. So each figure carries up to one poll interval plus one RPC round trip of
slack, and is never smaller than the truth. The poll interval is recorded in the run file.

Adding a chain family: one file in `chains/`, exporting a function that takes the chain file and
returns a `Driver`; register it in `cli.ts`. Everything chain-specific that is not code goes in
`chains/<id>.yaml` at the repository root.
