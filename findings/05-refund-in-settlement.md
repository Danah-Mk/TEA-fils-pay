# Settlement batches ignore refunds (payout overpays the merchant)

**What is wrong / why:** The ledger moves on refund, but no batch ever took the refund out of the payout, so net payout stayed gross - fee. RecalculateMDR would also have rebuilt net as gross - newFee, dropping refunds.

**What it breaks:** Merchant is paid money that was already refunded; ledger and payouts drift apart.

**The fix:** Close batch claims unbatched refunds (oldest first, carried over if it would go negative); net = gross - fee - refunds + fee reversed. Needs migration 0073. NOTE: payload fields for batch_closed come with patch 06.

**How to check:** go test ./internal/refundclaim (pass). The Go DB code was only compiled against stubs: run go test ./... and one real run-batch.

**Files:** apps/settlement/internal/settlement/batch.go, apps/settlement/internal/refundclaim/claim.go, apps/settlement/internal/refundclaim/claim_test.go, apps/settlement/internal/settlement/recalculate_mdr.go, db/migrations/0073_refund_settlement_and_reporting.sql
