# expire_holds deletes every hold when the id list is empty

**What is wrong / why:** buildWhere skipped an empty array, producing DELETE FROM holds with no WHERE.

**What it breaks:** A quiet night deletes all holds in production.

**The fix:** Empty list means FALSE; script returns early.

**How to check:** sqlFilter.test.ts

**Files:** scripts/lib/sqlFilter.ts, scripts/lib/sqlFilter.test.ts, scripts/expire_holds.ts
