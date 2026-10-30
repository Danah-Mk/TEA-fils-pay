# Reporting never consumed settlement.paid

**What is wrong / why:** `REPORTING_EVENT_TYPES` omitted it, so payout trends stayed `closed` after pay. Missing daily-volume rows threw and stalled the watermark.

**The fix:** Consume `settlement.paid` and mark trends paid. Treat a missing rollup as lag, not a crash (already in patch 07).

**Files:** `apps/reporting/src/consumer/runConsumerPass.ts`, `apps/reporting/src/consumer/applyEvent.ts`
