# Recompute statuses flips test_mode

**What is wrong / why:** reconcileSandboxFlag cleared test_mode when no open authorizations.

**What it breaks:** Sandbox merchants become settleable.

**The fix:** Function no longer changes anything.

**How to check:** Run recompute on a test_mode merchant: flag unchanged.

**Files:** apps/api/src/admin/merchantFlags.ts
