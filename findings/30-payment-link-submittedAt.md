# Payment link expiry trusted the client's submittedAt (FP-187)

**What is wrong / why:** Public pay used the body field as the clock, so an expired link could be paid with a past timestamp.

**What it breaks:** Buyers (or anyone with the token) pay after expiry.

**The fix:** `expiryReferenceTime` always returns `new Date()`. Offline-terminal grace needs a signed timestamp if product still wants it.

**How to check:** Expired link + `submittedAt` in the past → 410/expired, not 200.

**Files:** `apps/api/src/paymentLinks/pay.ts`
