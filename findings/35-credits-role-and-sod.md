# Support could issue credits; SoD compared display names

**What is wrong / why:** Create-credit route was session-only. Two-person control compared `displayName`, not admin id. Credits posted at a free-form effective date into closed periods.

**What it breaks:** Support posts ledger money. Same person with two names self-approves.

**The fix:** Create requires finance/super_admin. `assertDistinctApprover` compares `adminUserId`.

**How to check:** Support POST /credits → 403. Same adminUserId approve → 409 even with different names.

**Files:** `apps/api/src/routes/adminCredits.ts`, `apps/api/src/admin/creditApproval.ts`
