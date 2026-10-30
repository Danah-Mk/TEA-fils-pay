# Reports never show refunds; refunds bucketed on UTC date

**What is wrong / why:** The consumer did not read refund.succeeded; its daily rollup used the UTC date; the batch-closed parity check crashed if no rollup row existed.

**What it breaks:** Refund counts missing from dashboards; a 01:00 Bahrain refund lands on the wrong day; a missing rollup row stalls the whole consumer pass.

**The fix:** Handle refund.succeeded with the Bahrain date, store refund terms in payout trends, guard the parity check, expose the fields in analytics.

**How to check:** applyEvent.test.ts

**Files:** apps/reporting/src/consumer/applyEvent.ts, apps/reporting/src/consumer/runConsumerPass.ts, apps/reporting/src/consumer/applyEvent.test.ts, apps/api/src/analytics/query.ts
