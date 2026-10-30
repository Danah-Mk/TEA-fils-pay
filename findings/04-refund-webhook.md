# Shop never gets a refund webhook

**What is wrong / why:** refund.succeeded was neither in the dispatcher's eligible list nor mapped by buildEnvelope (adding only the list entry would throw in Step A and stall the whole queue).

**What it breaks:** Merchants are never told about refunds.

**The fix:** Add the envelope case and the eligible entry together.

**How to check:** envelope.test.ts

**Files:** apps/api/src/webhooks/dispatcher.ts, apps/api/src/webhooks/envelope.ts, apps/api/src/webhooks/envelope.test.ts
