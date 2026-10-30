# Refund helper writes reason = NULL (every refund fails)

**What is wrong / why:** processRefund inserted reason NULL; migration 0070 made the column NOT NULL (an explicit NULL bypasses the DEFAULT). The same patch also fixes the over-refund race (it called the acquirer between two transactions with no row lock), the wrong refundable base (authorized - refunded, now captured - refunded), the fee reversal (cumulative, so it sums to the fee) and releases the hold.

**What it breaks:** Every refund fails with a CHECK violation; if it did get through, two parallel refunds could refund more than was captured.

**The fix:** Single locked transaction; reason defaults to 'unspecified'; refundable = captured - refunded; status derived from captured.

**How to check:** 11 pre-existing failing refund tests now pass; routes/refunds.test.ts concurrency test (4 parallel 4,000 refunds of 10,000 -> exactly 2 succeed).

**Files:** apps/api/src/payments/processRefund.ts, apps/api/src/payments/refundState.ts
