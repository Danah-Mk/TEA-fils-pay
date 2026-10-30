# Duplicate settlement.paid (incident 2026-08-21)

**What is wrong / why:** Enqueue used NOT EXISTS then INSERT with no unique index. Daemon tick + run-batch both passed the check.

**The fix:** Partial unique index on `outbox_events(aggregate_id) WHERE event_type = 'settlement.paid'`.

**Files:** `db/migrations/0076_security_and_integrity.sql`
