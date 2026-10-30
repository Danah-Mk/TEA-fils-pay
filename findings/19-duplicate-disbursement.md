# Payout disbursement is a side effect of webhook delivery

**What is wrong / why:** recordPayoutDisbursementEffect runs on the first attempt of EVERY delivery: one per subscribed endpoint, plus replays.

**What it breaks:** The same payout instructed several times.

**The fix:** Insert only if the batch has none. Structural fix still open: write it inside PayoutBatch's transaction.

**How to check:** Two endpoints subscribed: one disbursement row.

**Files:** apps/api/src/webhooks/payoutDisbursement.ts
