# Sources for the chain landscape, and their terms (read 2026-10-18)

The page needs to know which chains hold the most dollars. Measuring the supply on one chain is easy
(read the USDT and USDC contracts); knowing the whole landscape is not. So a public list is read on the
run day for the ranking, and our own readings supply the figures.

## DeFiLlama — `https://stablecoins.llama.fi/stablecoinchains` (free, no key)

The endpoint answers without a key and is in their free endpoint list (`api-docs.defillama.com`). The
docs state no terms; their llms.txt opens "DefiLlama provides free, open-source DeFi analytics data".
Their Terms of Use (`defillama.com/terms`, effective 24 June 2025) cover "official public API(s)"
(cl. 1), grant a licence "for personal, non-commercial purposes" (cl. 7) and forbid, among others, to
"republish the data in any form without permission", to "resell the data … without permission" and to
"copy, scrape, harvest or otherwise exploit the Content & Data for commercial purposes without prior
written consent" (cl. 8), with liquidated damages up to USD 100,000 per violation (cl. 14). No
attribution clause. The "free, open-source" line and the Terms are not reconciled anywhere on their site.

Proposed use: the ranking only, credited as "ranked by DeFiLlama's stablecoin supply by chain, <date>";
the dollar figures on the page are our own on-chain readings; permission asked in writing in parallel.
Whether that is enough is the author's decision.

## CoinGecko — `https://api.coingecko.com/api/v3/coins/markets` (Demo plan, key or keyless)

API Terms (`coingecko.com/en/api_terms`, version 5 Sept 2025): attribution mandatory — 4.3 "Powered by
CoinGecko", prominent, font no smaller than 10, per the attribution guide (text options "Data provided
by CoinGecko" and the like, or the logo linked to coingecko.com); a website built on the API is allowed
(3.1) and may charge (4.1.6), but no selling, sub-licensing, re-distributing or syndicating API access
(4.1.6); caching "not encouraged", if cached refresh at least every 24 h (6.1), no storing or deriving
beyond that (6.2); a public product needs a user agreement and privacy policy naming CoinGecko (7.1).
The pricing page's Demo column says "Attribution required", 10k calls/month, 100/min, and its License
cell is an ✗ where every paid plan says "Commercial" (Basic, $29/mo yearly, "for personal use cases").

Proposed use: the carrier coin's market cap in the *why it is here* line, with "market caps by
CoinGecko" credited under the rule — or dropped if the Demo plan's licence is judged insufficient.

## CoinMarketCap — Basic plan (free, key)

Commercial Terms (`pro.coinmarketcap.com/user-agreement-commercial`, undated): attribution mandatory —
"Data provided by CoinMarketCap.com" with a hyperlink; licence for one product whose end users use it
"for their own personal, non-commercial purposes", up to 100k monthly users; temporary storage and
distribution only "as part of Your Product … not on a standalone basis"; no logo use. The pricing page
says the free Basic plan (15,000 credits/month, 50/min, 60 s updates) includes commercial use rights
"inside your own product".

Alternative to CoinGecko for market caps, with its attribution line.

## Our own readings

For each chain on the page: USDT and USDC supply from the token contracts over RPC on the run day,
cross-checked against the issuers' transparency pages. Dated, reproducible, no licence.

## Chain documentation

Each chain's claim about its own finality is quoted from its documentation in `chains/<id>.yaml`, with
the URL, the date read and the date of the next read. Quotations, never paraphrases.
