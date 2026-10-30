# Adjustment import amounts are 10x too small

**What is wrong / why:** parseDecimalMinor defaults to 2 decimals and silently truncates; BD has 3.

**What it breaks:** Every imported adjustment is wrong by 10x, extra digits vanish.

**The fix:** parseBhdToFils (exact, rejects > 3 decimals).

**How to check:** adjustmentCsvParsing.test.ts

**Files:** apps/api/src/admin/adjustmentCsvParsing.ts, apps/api/src/admin/adjustmentCsvParsing.test.ts
