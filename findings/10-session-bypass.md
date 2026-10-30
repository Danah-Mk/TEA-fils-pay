# Password-only login passes as fully authenticated

**What is wrong / why:** lookupSession reads the live_sessions view (0058) which selects 'authenticated' but never filters on it.

**What it breaks:** The OTP step can be skipped.

**The fix:** Add AND s.authenticated = true to the lookup.

**How to check:** Log in with password only, call /v1/auth/me: must be 401.

**Files:** apps/api/src/auth/sessions.ts
