# Destructive admin actions had no confirmation

**What is wrong / why:** Apply import, Run batch, Recalculate MDR posted money on a single click. Only rebuild asked first.

**The fix:** `window.confirm` on those three. Import also has content-hash dedupe (patch 23).

**Files:** `apps/admin/src/pages/settlement/SettlementPage.tsx`, `apps/admin/src/pages/adjustments/AdjustmentImportPage.tsx`
