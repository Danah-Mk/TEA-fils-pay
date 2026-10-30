# Dashboard threw on negative fils (blank reconciliation)

**What is wrong / why:** `bhd()` called `toFils` without `allowNegative`. Gap and ledger net are signed. No error boundary → blank page.

**The fix:** `toFils(amountFils, { allowNegative: true })` in `apps/web/src/format.ts`.

**How to check:** Open Reconciliation with a negative gap; the number renders.

**Files:** `apps/web/src/format.ts`
