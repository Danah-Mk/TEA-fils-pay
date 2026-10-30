# Admin rebuild read a view; CLI read the ledger (FP-203)

**What is wrong / why:** Button → `merchant_payable_position` (sum of scheme lines). CLI → `ledger_entries`. Alpha jumped 135K → 7K. `--merchant` rebuild was SELECT-only and never wrote.

**The fix:** Admin handler calls `RebuildAllBalances`. `RebuildMerchantBalance` upserts the cache.

**Files:** `apps/settlement/internal/internalapi/server.go`, `apps/settlement/internal/ledger/rebuild.go`
