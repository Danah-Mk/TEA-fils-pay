# API key rotation did not revoke the old key

**What is wrong / why:** Admin rotate issued a new key and left `revoked_at` null on the old one. Comments disagreed (immediate revoke vs 24h grace). Merchant DELETE did revoke.

**What it breaks:** Both keys work after "rotation".

**The fix:** Same transaction: `UPDATE api_keys SET revoked_at = now()` on the previous id.

**How to check:** After rotate, the old secret is 401; the new secret works.

**Files:** `apps/api/src/admin/apiKeys.ts`
