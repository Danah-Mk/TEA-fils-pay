# OTPs and tokens use Math.random

**What is wrong / why:** randomDigits / randomFromAlphabet used Math.random.

**What it breaks:** Guessable OTPs and references.

**The fix:** crypto.randomInt.

**How to check:** Quick unit check (done).

**Files:** apps/api/src/lib/random.ts
