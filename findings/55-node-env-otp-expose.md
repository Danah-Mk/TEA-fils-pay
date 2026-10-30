# NODE_ENV typos became development; OTPs went out on the wire

**What is wrong / why:** Unknown `NODE_ENV` silently became development. Then OTPs were in JSON and webhook secrets used a committed fallback key. Signature requirement defaulted off.

**The fix:** Unknown NODE_ENV throws. `otpDevExpose` defaults false. Encryption key required except in test. Callback signatures required by default.

**Files:** `apps/api/src/config.ts`
