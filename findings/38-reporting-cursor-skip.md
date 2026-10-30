# Reporting cursor skipped late-committing outbox rows

**What is wrong / why:** `WHERE id > last ORDER BY id`. Sequence ids are assigned at INSERT, not COMMIT. The cursor was read without FOR UPDATE, so worker + catch-up double-counted.

**What it breaks:** Silent under-count and over-count on volume widgets.

**The fix:** `SELECT ... FOR UPDATE` on the cursor row. Only read ids whose `xmin` is below `pg_snapshot_xmin(pg_current_snapshot())`.

**How to check:** Hold an outbox insert open, let the worker pass it, commit; the next pass must pick it up.

**Files:** `apps/reporting/src/consumer/cursor.ts`, `apps/reporting/src/consumer/runConsumerPass.ts`
