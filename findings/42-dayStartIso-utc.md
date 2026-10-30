# Transaction filters used UTC midnight, not Bahrain

**What is wrong / why:** `dayStartIso` comment said Bahrain; body was `T00:00:00.000Z` (3h off vs settlement days).

**The fix:** `T00:00:00+03:00`.

**Files:** `apps/web/src/format.ts`
