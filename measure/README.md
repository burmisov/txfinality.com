# measure/ — the runner

TypeScript on Node 22.6+ (types are stripped at start; nothing is compiled). No framework.

```
bin.js          `npx txfinality …` lands here and re-launches node with type stripping on
cli.ts          the three commands: measure, watch, wallet
run.ts          the clock, the pacing (one transfer per second), the polling, the run file
driver.ts       what a chain driver provides: prepare, send, status — and optionally recent, for `watch`
chain.ts        reads chains/<id>.yaml, checks it, hashes it
env.ts          .env loading (repository first, then ~/.config/txfinality/.env); the host of an RPC URL
chains/
  solana.ts     the Solana driver: transferChecked + memo + a small priority fee; levels from
                getSignatureStatuses: processed, confirmed, finalized
```

```sh
npm run typecheck
npm test
npx txfinality watch   --chain solana              # read-only: times live transfers from first sight
npx txfinality wallet  --chain solana              # a sender and a recipient into .env (mode 0600)
npx txfinality measure --chain solana --runs 20 [--poll-ms 250] [--cap-minutes 30] [--machine "runner-1"]
```

How a figure is made: the signed bytes are built first; the clock starts the instant before they are
sent; every open transfer is polled in one request per interval; a level's time is when the poll that
first showed it came back. So each figure carries up to one poll interval plus one RPC round trip of
slack, and is never smaller than the truth. The poll interval is recorded in the run file.

Adding a chain family: one file in `chains/`, exporting a function that takes the chain file and
returns a `Driver`; register it in `cli.ts`. Everything chain-specific that is not code goes in
`chains/<id>.yaml` at the repository root.
