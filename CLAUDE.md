# FilsPay — Claude Code configuration

Updated 2026-10-30. Trust ADR-0001 (1000 fils) and Asia/Bahrain settlement days.
Do not follow older comments that say "cents", "UTC midnight", or "Math.random is fine".

## Money

Integer fils. `parseBhdToFils` for text. One half-even rounding (ADR-0001).

## Settlement

Go `CloseBatch` is authoritative for fees. Net payout is `gross - fee` in integers.
Scheme lines are truncated to 10 fils; residue posts to `scheme_rounding_residue`.

## Refunds

FP-212 is shipped. Route, settlement, webhook, reporting, drawer.

## Frozen packages

`packages/money` is the ADR-0001 implementation. Do not introduce a 2-decimal scale
anywhere else (`lib/decimal.ts`, CSV import, discount parse) either.

## Tests

Correct a test that pins a bug. Do not keep a 10× under-post or a 501 refund stub
because a comment said "locked".
