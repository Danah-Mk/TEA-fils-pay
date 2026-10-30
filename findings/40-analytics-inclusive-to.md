# Ledger activity treated `to` as inclusive

**What is wrong / why:** `BETWEEN $2 AND $3` includes the exclusive `to` date every other analytics endpoint uses as half-open.

**What it breaks:** One extra Bahrain day on the ledger widget.

**The fix:** `>= from AND < to`.

**Files:** `apps/api/src/analytics/query.ts`
