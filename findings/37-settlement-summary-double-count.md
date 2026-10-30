# Settlement summary double-counted multi-capture payments

**What is wrong / why:** Joined every capture event and summed `t.captured_fils` (running total) per event row.

**What it breaks:** Delta Marketplace summary ~38% above batch gross.

**The fix:** Sum `te.amount_fils` (the event amounts in the window).

**How to check:** Two partial captures on one txn: summary gross equals the sum of the two event amounts, not 2× captured_fils.

**Files:** `apps/api/src/settlement/query.ts`
