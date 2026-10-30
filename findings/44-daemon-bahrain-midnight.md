# Daily close ran at ~03:15 Bahrain, not 00:15

**What is wrong / why:** Daemon took `time.Now().UTC()` then `BusinessDayWindow`, which uses the input's own calendar date. UTC midnight is 03:00 Bahrain.

**What it breaks:** Captures 00:00–03:00 Bahrain land in the wrong business day (finance chat + ticket).

**The fix:** `now := time.Now().In(Asia/Bahrain)` before the window.

**Files:** `apps/settlement/internal/scheduler/daemon.go`
