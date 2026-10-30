# Bulk KYC approval ignores status

**What is wrong / why:** UPDATE merchants ... WHERE id = ANY($1) with no status condition (docs say only under_review).

**What it breaks:** Rejected/draft merchants approved.

**The fix:** AND onboarding_status = 'under_review'.

**How to check:** admin.test.ts bulk tests (the audit-rollback test uses 'submitted' merchants: check it still asserts what you want).

**Files:** apps/api/src/admin/bulkKyc.ts
