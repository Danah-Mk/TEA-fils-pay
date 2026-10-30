# Seed script truncates core tables of whatever database it points at

**What is wrong / why:** TRUNCATE merchants, ledger_entries... CASCADE; docs wrongly call it safe on shared databases.

**What it breaks:** Data loss in production.

**The fix:** Refuse under NODE_ENV=production unless SEED_ALLOW_DESTRUCTIVE_RESET=yes.

**How to check:** Run with NODE_ENV=production: refuses.

**Files:** db/seed/index.ts
