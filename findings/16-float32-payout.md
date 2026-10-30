# Net payout computed in float32

**What is wrong / why:** NetPayableFils used float32 / 1000.

**What it breaks:** Payout off by 1-2 fils (13 of 80 sampled batches).

**The fix:** Integer subtraction.

**How to check:** go test ./internal/settlement (needs real pgx).

**Files:** apps/settlement/internal/settlement/payable.go
