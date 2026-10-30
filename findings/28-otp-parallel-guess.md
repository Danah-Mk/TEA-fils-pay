# OTP guess budget can be bypassed in parallel

**What is wrong / why:** Verify read `attempt_count`, compared, then incremented in a second statement with no row lock. Parallel POSTs all saw 0. Resend inserted a new challenge at attempt_count=0, restarting the budget.

**What it breaks:** A 6-digit OTP with a 5-guess cap is brute-forceable.

**The fix:** One atomic `UPDATE ... SET attempt_count = attempt_count + 1 WHERE attempt_count < max_attempts AND consumed_at IS NULL AND expires_at > now() RETURNING ...`. Resend copies the previous `attempt_count` onto the new row. Same for admin OTP.

**How to check:** Fire 20 parallel wrong codes against one challenge; only 5 should be `invalid_code`, the rest `too_many_attempts`. Resend, then only the remaining budget is left.

**Files:** `apps/api/src/routes/auth.ts`, `apps/api/src/routes/adminAuth.ts`, `apps/api/src/auth/otp.ts`
