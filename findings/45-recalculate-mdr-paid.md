# Recalculate MDR rewrote paid batches

**What is wrong / why:** Selected `status <> 'open'` at current `mdr_bps`, ignoring `fee_schedules`. Overwrote fee/net on already-disbursed days.

**What it breaks:** History no longer matches cash sent (finance memo).

**The fix:** `status = 'closed'` only. Fees from `LoadFeeSchedules` / `EffectiveMdrBpsAt` like CloseBatch.

**Files:** `apps/settlement/internal/settlement/recalculate_mdr.go`
