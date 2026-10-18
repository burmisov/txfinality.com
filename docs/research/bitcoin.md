# Bitcoin — what the docs say

Read 2026-10-18. Quotes are verbatim from the page named; nothing here is paraphrased. Re-read monthly (see `claim.next_read` in `chains/bitcoin.yaml`).

## Pages

- https://developer.bitcoin.org/devguide/payment_processing.html (section “Verifying Payment”)
- https://developer.bitcoin.org/devguide/block_chain.html (retarget arithmetic)
- https://developer.bitcoin.org/reference/rpc/gettransaction.html

## Quotes

- “1 confirmation: The transaction is included in the latest block and double-spend risk decreases dramatically. Transactions which pay sufficient transaction fees need 10 minutes on average to receive one confirmation. However, the most recent block gets replaced fairly often by accident, so a double spend is still a real possibility.”
  — https://developer.bitcoin.org/devguide/payment_processing.html
- “6 confirmations: The network has spent about an hour working to protect the transaction against double spends and the transaction is buried under six blocks. Even a reasonably lucky attacker would require a large percentage of the total network hashing power to replace six blocks. Although this number is somewhat arbitrary, software handling high-value transactions, or otherwise at risk for fraud, should wait for at least six confirmations before treating a payment as accepted.”
  — https://developer.bitcoin.org/devguide/payment_processing.html
- “The ideal value is 1,209,600 seconds (two weeks).”
  — https://developer.bitcoin.org/devguide/block_chain.html (per 2,016 blocks: 600 s a block)
- “"confirmations" : n, (numeric) The number of confirmations for the transaction. Negative confirmations means the transaction conflicted that many blocks ago.”
  — https://developer.bitcoin.org/reference/rpc/gettransaction.html

## Notes and gaps

- The docs present six confirmations as a custom, not as finality; no absolute-finality statement exists on the page.
- The block_chain.html page I had linked first says nothing about ten minutes or six confirmations; the payment_processing page does.
