# Transaction page/DTO has no refunded amount; refund drawer parked and wrong

**What is wrong / why:** No refundedFils on the DTO; the drawer posted to /v1/merchants/:id/refunds and generated a new idempotency key per click.

**What it breaks:** Refund button missing; a double click refunds twice.

**The fix:** Add refundedFils; restore the drawer pointing at /v1/refunds with one key per attempt; mount it.

**How to check:** Not built or rendered here: run the web build.

**Files:** apps/api/src/transactions/serialize.ts, apps/web/src/pages/transactions/RefundDrawer.tsx, apps/web/src/pages/transactions/TransactionDetailPage.tsx, apps/web/src/types.ts
