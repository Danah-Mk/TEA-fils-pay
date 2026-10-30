# Migration runner claimed checksums and did not store them

**What is wrong / why:** Comments said edited applied files are refused. Table was filename + applied_at only.

**The fix:** Store sha256; on SKIP compare and abort on mismatch.

**Files:** `db/migrate.ts`
