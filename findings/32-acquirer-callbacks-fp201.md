# Duplicate acquirer callbacks / missing processed_events (FP-201)

**What is wrong / why:** Docs claimed `processed_events`. It did not exist. Missing signature headers were treated as valid. `ACQUIRER_CALLBACK_REQUIRE_SIGNATURE` defaulted false. `callback_id` was not unique.

**What it breaks:** Unsigned public POSTs accepted; the same callback stored two notes.

**The fix:** `processed_events` table; insert first `ON CONFLICT DO NOTHING`; unique on `callback_id`; require signature by default; missing header is invalid.

**How to check:** POST the same callback twice → one note. POST with no header → 401.

**Files:** `apps/api/src/acquirer/callbacks.ts`, `apps/api/src/webhooks/inboundVerify.ts`, `apps/api/src/config.ts`, `db/migrations/0076_security_and_integrity.sql`
