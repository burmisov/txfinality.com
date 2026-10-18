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

This repository never holds a key. With your own wallets and RPC URL:

```sh
git clone https://github.com/burmisov/txfinality.com
cd txfinality.com
cp .env.example .env            # your RPC URL and the two wallets for the chain you care about; never committed
npm install
npx txfinality measure --chain solana --runs 20     # → runs/solana/<stamp>.json, with the hashes
```

The page is built elsewhere from these files; the figures on it are the figures in `runs/`. If you think a
figure is wrong, open an issue with your run file.

## Status

Nothing is measured yet (18 October 2026). The runner is being written.

## Made by

[burmisov.com](https://burmisov.com/) ✱
