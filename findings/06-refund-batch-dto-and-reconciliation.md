# Settlement DTOs and reconciliation do not know about refunds

**What is wrong / why:** Batch DTOs had no refund fields and the reconciliation gap counted only captures.

**What it breaks:** Reconciliation shows a false gap as soon as any refund exists.

**The fix:** Add refundFils/refundFeeReversedFils/includedRefundCount, count unbatched and carried refunds as pending. (scheme_export.go here only adds the two payload fields.)

**How to check:** refunds.test.ts reconciliation tests; fails with gap -4,225 without the patch.

**Files:** apps/api/src/settlement/query.ts, apps/settlement/internal/settlement/scheme_export.go
