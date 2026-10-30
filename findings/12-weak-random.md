# OTPs and tokens use Math.random

**What is wrong / why:** randomDigits / randomFromAlphabet used Math.random.

**What it breaks:** Guessable OTPs and references.

**The fix:** crypto.randomInt / randomFromAlphabet. Admin invite codes use the same helper (no Math.random).

**How to check:** Quick unit check (done). inviteCode.test.ts.

**Files:** apps/api/src/lib/random.ts, apps/api/src/admin/inviteCode.ts
