# Migration 0055 fails (columns do not exist)

**What is wrong / why:** Inserted code/account_type/description; the table is (id, name, kind).

**What it breaks:** A fresh database cannot be migrated.

**The fix:** Rewrite the insert.

**How to check:** Applied in Postgres.

**Files:** db/migrations/0055_chart_of_accounts_suspense.sql
