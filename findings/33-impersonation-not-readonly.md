# Impersonation was full owner, not read-only support

**What is wrong / why:** Code mapped `super_admin → owner` and `finance → finance`. Capture/void had no role gate. Writer attribution recorded impersonation as `merchant_session`. Disabled admins kept grants.

**What it breaks:** "View as merchant" can capture, void, and refund. Audit looks like the merchant did it.

**The fix:** Every grant maps to `support`. `requireMerchantWriterActor` throws `impersonation_read_only`. Capture/void require owner/finance. Lookup requires `admin_users.status = 'active'`.

**How to check:** Super-admin impersonation cannot POST capture/void/refund. Support merchant users cannot either.

**Files:** `apps/api/src/admin/impersonation.ts`, `apps/api/src/auth/requireMerchantAuth.ts`, `apps/api/src/routes/transactions.ts`
