# Webhook URLs could hit loopback; fetch followed redirects

**What is wrong / why:** Validator required https in prod but not a public address. `fetch` followed redirects and read the body unbounded.

**The fix:** Reject localhost/private/link-local hostnames in production. `redirect: "error"`.

**Files:** `apps/api/src/webhooks/create.ts`, `apps/api/src/webhooks/transport.ts`
