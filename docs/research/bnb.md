# BNB Chain — what the docs say

Read 2026-10-18. Quotes are verbatim from the page named; nothing here is paraphrased. Re-read monthly (see `claim.next_read` in `chains/bnb.yaml`).

## Pages

- https://docs.bnbchain.org/bnb-smart-chain/introduction/ (section “Fast Finality”)
- https://docs.bnbchain.org/bnb-smart-chain/developers/json_rpc/bsc-api-list/ (section “Finality API”)
- https://docs.bnbchain.org/bnb-smart-chain/overview/
- https://docs.bnbchain.org/bnb-smart-chain/developers/json_rpc/json-rpc-endpoint/

## Quotes

- “Short block time, 0.45 seconds on mainnet (reduced from 3s through the Lorentz, Maxwell, and Fermi hardforks).”
  — https://docs.bnbchain.org/bnb-smart-chain/introduction/
- “With Fast Finality enabled (since the Plato upgrade), the chain is finalized within two blocks if ⅔*N or more validators vote normally. At the current block time of 0.45 seconds, this means finality is achieved in approximately 1.125 seconds. If Fast Finality votes are insufficient, the chain falls back to probabilistic finality where more confirmations increase safety.”
  — https://docs.bnbchain.org/bnb-smart-chain/introduction/
- “String “safe” - for the latest justified head block”
  — https://docs.bnbchain.org/bnb-smart-chain/developers/json_rpc/bsc-api-list/
- “String “finalized” - for the latest finalized block”
  — https://docs.bnbchain.org/bnb-smart-chain/developers/json_rpc/bsc-api-list/
- “Transaction finality time: ~3.75 seconds (with 1.5 seconds block time)”
  — https://docs.bnbchain.org/bnb-smart-chain/developers/json_rpc/bsc-api-list/ (stale against the 0.45 s block time stated elsewhere; both verbatim)

## Notes and gaps

- Chain id 56; public endpoints include https://bsc-dataseed.bnbchain.org.
- Probabilistic fallback when votes are short: ">½" 88 blocks, ">⅔" 120 blocks.
- Asset: Circle lists no USDC on BSC and Tether's page lists only XAU₮ for BSC. The USDT everyone uses there is Binance-Peg BSC-USD, 0x55d398326f99059fF775485246999027B3197955; read over RPC on 2026-10-18 it answers name "Tether USD", symbol USDT, 18 decimals. Decision of 2026-10-18: use USDT where a chain only has USDT.
