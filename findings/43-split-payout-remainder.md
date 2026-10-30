# Split payouts were a few fils short every batch

**What is wrong / why:** Weights were not required to sum to 10,000 bps. Each child was independent `ApplyRateFils` (no remainder). Legs posted against the parent only. `ApplyPayout` took `totalAllocated` not net.

**What it breaks:** Delta Marketplace children underpaid; missing fils stuck on the parent; batch still marked paid.

**The fix:** Reject weight sum ≠ 10000. Largest-remainder so shares sum to net. Credit each child, then pay the child out. `ApplyPayout(netPayout)`.

**Files:** `apps/settlement/internal/splits/allocate.go`, `apps/settlement/internal/splits/shares.go`
