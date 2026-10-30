# Webhook delivery had no claim; disabled endpoints still fired

**What is wrong / why:** Step B selected due rows with no `FOR UPDATE SKIP LOCKED` and no `we.status = 'active'`. Two API replicas double-delivered.

**The fix:** CTE claims due active-endpoint rows with `SKIP LOCKED` and leases `next_attempt_at`.

**Files:** `apps/api/src/webhooks/dispatcher.ts`
