# Migration 0054 fails (view on a table that does not exist)

**What is wrong / why:** References settlement_batch_events (never created); also only matched 'captured'.

**What it breaks:** A fresh database cannot be migrated.

**The fix:** Use transaction_events.settlement_batch_id IS NULL and both capture types.

**How to check:** Applied in Postgres (rolled back test).

**Files:** db/migrations/0054_views.sql
