# Payout disbursement is a side effect of webhook delivery

**What is wrong / why:** recordPayoutDisbursementEffect runs on the first attempt of EVERY delivery: one per subscribed endpoint, plus replays.

**What it breaks:** The same payout instructed several times.

**The fix:** Insert only if the batch has none. PayoutBatch now writes the row in the same transaction as the ledger legs. The webhook path is a backfill for batches paid before that change.

**How to check:** Two endpoints subscribed: one disbursement row. Paying a batch inserts settlement_payout_disbursements even with no webhook delivery.

**Files:** apps/settlement/internal/settlement/batch.go, apps/api/src/webhooks/payoutDisbursement.ts
