# live_sessions view itself still omitted authenticated = true

**What is wrong / why:** Migration 0058 selected `authenticated` but never filtered on it. Patch 10 fixed the query; a replica or a future query on the view could still skip OTP.

**What it breaks:** Password-only pending cookies authenticate for 10 minutes.

**The fix:** Migration 0076 recreates the view with `AND authenticated = true`. Pending lookup stays on base `sessions`.

**How to check:** After password login, before OTP, `GET /v1/me` is 401. After OTP, 200.

**Files:** `db/migrations/0076_security_and_integrity.sql`
