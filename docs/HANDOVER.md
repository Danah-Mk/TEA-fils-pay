# Handover — Yousif Al-Ansari (last day 2026-04-09)

Written over my last three days. Some of this is plans rather than facts;
Mahmood has the context for most of it.

— YA

*(Moved here from the wiki by MK in May. Not re-reviewed since.)*

## State of things

**Refunds (FP-212).** Shipped: `POST /v1/refunds` is live (was a 501 stub).
`processRefund` now locks the transaction row, scopes by merchant, defaults
reason to `unspecified`, refunds captured-not-authorized remainder, and
releases the leftover hold. Settlement batches net refunds; `refund.succeeded`
is on the webhook and reporting paths. The dashboard refund drawer is restored.

**Scheme residue.** CloseBatch now truncates each export line to a multiple
of 10 fils, stores that truncated figure, and journals `gross - truncated`
to `scheme_rounding_residue` (ADR-0002). The March one-off script is
idempotent (skips a merchant that already has the sweep description).

> **MK (May):** 0038 was replaced by the KYC thumbnail migration; `amount_3dp` is gone. 0050 covers the scheme amount now.

**Verify residue with Visa.** Open with the acquirer's integration contact
since December: does the scheme truncate or round at their end, and would
they accept three decimals in `amount_minor`? Their answer so far was "it
depends on the BIN range". I asked which ranges. Please chase.

**March close (FP-187).** Finance asked for a one-off check script. I think
March is fine and the script is belt-and-braces. Whoever writes it must use
the Bahrain month, not a UTC month — I told Mahmood.

**Balances.** The only way to rebuild `merchant_balances` is the CLI
(`settlement rebuild-balances`), which reads the ledger. There is no console
button, and there shouldn't be one that reads anything else.

**Platform volume tier.** Huda floated a platform-wide discount once total
volume passes a threshold. I said no until finance signs off in writing.
`platform_stats.total_processed_fils` is INTEGER, which is fine while it's
only a counter.

**`apps/api/src/v1/`** is the partner API. Leave it alone; a partner
integrates against it.

**Webhook signing.** The dispatcher should sign exactly the bytes it sends.
Branch `ya/sign-raw` has a change for this; not merged.

**Holds.** `scripts/expire_holds.ts` flips `active` to `expired` with one
UPDATE. Holds are never deleted.

**Timezone.** Settlement business day is Asia/Bahrain, fixed constant, no
DST. `BusinessDayWindow` in window.go is correct and tested. The daemon's
"yesterday" is computed from the UTC date; harmless because of when it
runs, but the comment there says Bahrain.

**Impersonation** maps every admin to the `support` merchant role and is
read-only. Capture, void and refund refuse impersonation writes.

**Credits.** The second approver is compared by admin user id. The
effective date is metadata; ledger rows go in at now().

**Callbacks.** Acquirer callbacks insert into `processed_events` first
(`ON CONFLICT DO NOTHING`). Missing signatures are rejected. Signature
requirement defaults on.

**Not finished:** per-service DB roles and TLS (compose uses one role and
`sslmode=disable`); outbox consumption by commit order instead of id (the
xid8 query is in a gist); the shadow ledger (Mahmood's idea — I'd skip it).

**Migrations 0054 and 0055** used to fail on a fresh database (view on a
missing table; columns that did not exist). They are rewritten. 0056 is the
API-key revoke migration, not v2 ledger. New: 0073–0076 (refunds, import
dedupe, live_sessions filter, processed_events, BIGINT volume).

## People

- Huda knows the numbers. Trust what she sends in writing over what anyone
  remembers her saying.
- The acquirer integration contact has changed; ask Mahmood.

Good luck. Yalla.
