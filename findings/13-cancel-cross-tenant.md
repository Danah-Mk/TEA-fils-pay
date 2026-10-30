# Any merchant can cancel any payment link

**What is wrong / why:** cancelPaymentLink had no merchant filter; the route's assertOwnMerchant only compares the URL's merchant id with the caller, never the link.

**What it breaks:** Cross-tenant write.

**The fix:** Filter by merchant_id in both queries; the route passes the authenticated merchant.

**How to check:** Cancel merchant B's link with merchant A's key: 404.

**Files:** apps/api/src/paymentLinks/cancel.ts, apps/api/src/routes/paymentLinks.ts
