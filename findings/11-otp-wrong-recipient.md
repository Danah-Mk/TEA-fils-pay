# OTP is sent to another merchant's user

**What is wrong / why:** findOtpRecipient resolved the recipient by email across all merchants (seed even has duplicate emails).

**What it breaks:** Cross-tenant OTP delivery / account takeover.

**The fix:** Send the OTP to the user whose password was just verified.

**How to check:** Two merchants with the same email: OTP goes to the right one.

**Files:** apps/api/src/routes/auth.ts
