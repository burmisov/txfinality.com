# txfinality.com

**How long until a stablecoin transfer is final — measured, chain by chain.**

The data and the code behind [txfinality.com](https://txfinality.com). Everything the page shows is in
this repository: the chains, their levels in their own words, their claims quoted from their docs, every
run with its 20 transfers and their hashes, and the code that measured them.

## What is here

```
chains/      one file per chain: its levels, its claim quoted from its docs with the date read, the note
measure/     the runner — one driver per chain family; the code behind every figure on the page
runs/        every run, one JSON file per chain per run, append-only: 20 transfers, hashes, per-level
             times, the machine and the RPC provider
landscape/   the ranking of each run day: who holds the most dollars, and the cut
docs/        METHOD.md (how it is measured, versioned) · SOURCES.md (where the chain landscape comes from)
news.md      what changed, and when
```

## Run it yourself, for your chain

This repository never holds a key. With Node 22.6 or newer, an RPC URL and one wallet of yours:

```sh
git clone https://github.com/burmisov/txfinality.com
cd txfinality.com
npm install
cp .env.example .env               # your RPC URL for the chain; never committed
npx txfinality wallet --chain solana        # or put your own sender key in .env
#   → prints the sender to fund: a little SOL for fees and rent, and 20 USDC for 20 transfers of 1
npx txfinality measure --chain solana --runs 20     # → runs/solana/<stamp>.json, with the hashes
```

The runner makes its own recipient from the sender's key, creates its token account before the first
transfer, sends the USDC back and closes the account after the last. Transfers go one at a time, each
watched to final before the next. If a run is interrupted, `npx txfinality return --chain solana` does
the cleanup by hand.

Without a wallet, `npx txfinality watch --chain solana` times other people's transfers from first sight,
to see the levels move. It sends nothing.

The page is built elsewhere from these files; the figures on it are the figures in `runs/`. If you think a
figure is wrong, open an issue with your run file.

## Status

18 October 2026: the first run is in `runs/solana/`: twenty transfers of 1 USDC from runner-1 through Infura, one at a time. Slowest confirmed 1.105 s, slowest finalized 8.075 s. The page is not
built yet.

## Made by

[burmisov.com](https://burmisov.com/) ✱
