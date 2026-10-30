# Any merchant can refund another merchant's transaction

**What is wrong / why:** The transaction lookup was by id only.

**What it breaks:** Merchant A can move merchant B's money.

**The fix:** WHERE id = $1 AND merchant_id = $2; 404 transaction_not_found otherwise.

**How to check:** refunds.test.ts 'cross-tenant' test.

**Files:** apps/api/src/refunds/initiateMerchantRefund.ts
