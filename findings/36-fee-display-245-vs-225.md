# Dashboard showed 245 bps while billing used 225

**What is wrong / why:** Display ordered `fee_schedules` by `created_at DESC` with no `effective_from <= now()`, so a later backfill for March won over the live August 225 bps row.

**What it breaks:** Merchants and support see the wrong MDR (finance memo).

**The fix:** Same query as billing: `effective_from <= now() ORDER BY effective_from DESC, created_at DESC`.

**How to check:** Fixture with 225 effective Aug + 245 backfilled for March shows 225.

**Files:** `apps/api/src/fees/currentFeeScheduleDisplay.ts`
