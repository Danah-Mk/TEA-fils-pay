# Platform volume counter was int32 near the 2e9 fils tier

**What is wrong / why:** `INTEGER` / Go `int32`. The 15 bps tier starts at 2,000,000,000 fils, 8% below int32 max. Wrap turns the bonus off.

**The fix:** `BIGINT` + Go `int64`.

**Files:** `db/migrations/0076_security_and_integrity.sql`, `apps/settlement/internal/settlement/platform_volume.go`
