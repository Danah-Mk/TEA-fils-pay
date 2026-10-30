# March residue script was not idempotent

**What is wrong / why:** Each run used `randomUUID()` and posted again. Staging doubled the gap. Window is UTC month per ADR-0003 (not a bug).

**The fix:** Skip a merchant that already has the sweep description.

**Files:** `scripts/reconcile_march.ts`
