# Public payment-link read exposes an API key hash

**What is wrong / why:** SELECT ak.key_hash AS integration_id on an unauthenticated endpoint.

**What it breaks:** Credential hash leaked to anyone with a link.

**The fix:** Stop selecting it; merchantIntegrationId is null.

**How to check:** GET /v1/payment-links/:token body has no hash.

**Files:** apps/api/src/paymentLinks/read.ts
