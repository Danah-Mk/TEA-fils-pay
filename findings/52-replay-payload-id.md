# Webhook replay rewrote payload.id so receivers could not dedupe

**What is wrong / why:** Replay minted a new UUID and overwrote `payload.id`. ARCHITECTURE says the id is stable.

**The fix:** Keep the original payload (including `id`). New delivery row is still a new attempt.

**Files:** `apps/api/src/webhooks/replay.ts`
