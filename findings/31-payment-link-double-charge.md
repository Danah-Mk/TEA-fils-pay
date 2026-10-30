# Payment link charged twice after reservation timeout (2026-05-14)

**What is wrong / why:** Claim UPDATE re-took `reserved` after 60s. Slow 3DS let a second payer reclaim, capture, and finalize first; the first request still returned 200 after charging.

**What it breaks:** Two cards charged for one link.

**The fix:** Claim only `status = 'active'`. If finalize matches 0 rows, return 409, not 200.

**How to check:** Two overlapping pays after a delayed capture; one 200, one 409, one capture on the link.

**Files:** `apps/api/src/paymentLinks/pay.ts`
