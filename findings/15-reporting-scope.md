# Reporting endpoints accept any split-child merchant id

**What is wrong / why:** Only checked that the requested id is a child of SOME parent.

**What it breaks:** Read other merchants' data.

**The fix:** Require parent_merchant_id = caller.

**How to check:** Request another parent's child id: returns the caller's own data.

**Files:** apps/api/src/reporting/scope.ts
