# refund_merchant_summary view is always empty and double counts

**What is wrong / why:** Migration 0072 joined transactions t ON t.id = r.id (a refund id never equals a transaction id) and summed captured_fils once per refund.

**What it breaks:** Refund summary shows nothing / wrong totals.

**The fix:** 0074 drops and recreates the view with the right join and one captured_fils per transaction-day.

**How to check:** psql apply (done locally).

**Files:** db/migrations/0074_fix_refund_merchant_summary.sql
