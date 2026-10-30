# POST /v1/refunds returns 501 (the missing feature)

**What is wrong / why:** The route was a stub that always answered 501, and a test asserted the 501.

**What it breaks:** No refund can be made through the API.

**The fix:** Real route: owner/finance or API key, refuses admin impersonation, requires Idempotency-Key, validates body. 501 test removed; 12 route tests added.

**How to check:** npx tsx --test src/routes/refunds.test.ts

**Files:** apps/api/src/routes/refunds.ts, apps/api/src/routes/refunds.test.ts, apps/api/src/routes/transactions.test.ts
