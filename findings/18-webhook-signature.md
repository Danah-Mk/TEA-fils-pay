# Webhook body differs from the signed bytes

**What is wrong / why:** signPayload hashes canonicalJson(payload) but the body sent is JSON.stringify(payload) (jsonb key order).

**What it breaks:** Receivers verifying the body they received got 'invalid signature' (59 of 220 sampled deliveries; the export does not prove this cause). Apply AFTER patch 04 (same file).

**The fix:** Send canonicalJson(payload).

**How to check:** Verify a delivered body with verifySignature over the raw text.

**Files:** apps/api/src/webhooks/dispatcher.ts
