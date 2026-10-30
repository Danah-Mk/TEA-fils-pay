# Same adjustment CSV can be applied twice

**What is wrong / why:** Nothing stopped a re-upload (original_filename is not unique).

**What it breaks:** Ledger posted twice (31 rows, 428,677 fils).

**The fix:** Content hash + unique index; 409 duplicate_import. Needs migration 0075.

**How to check:** Upload the same file twice: second is 409.

**Files:** apps/api/src/admin/adjustmentImport.ts, db/migrations/0075_adjustment_import_dedupe.sql
